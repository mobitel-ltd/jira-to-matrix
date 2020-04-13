const R = require('ramda');
const logger = require('../../modules/log.js')(module);
const translate = require('../../locales');
const commands = require('./command-list');

module.exports = async ({ chatApi, sender, roomName, roomId, commandName, bodyText, roomData, config }) => {
    try {
        if (R.pipe(R.pathOr([], ['ignoreCommands']), R.includes(commandName))(config)) {
            const message = translate('ignoreCommand', { commandName });
            logger.warn(message);
            await chatApi.sendHtmlMessage(roomId, message, message);

            return message;
        }

        const command = commands[commandName];
        if (!command) {
            return;
        }
        const message = await command({ bodyText, roomId, roomName, sender, chatApi, roomData, config });

        if (message) {
            await chatApi.sendHtmlMessage(roomId, message, message);
        }
        logger.debug(
            `${commandName} successfully executed by ${sender} in room id "${roomId}" with alias "${roomName}"`,
        );

        return message;
    } catch (err) {
        const post = translate('errorMatrixCommands');
        await chatApi.sendHtmlMessage(roomId, post, post);
        logger.error(err);
    }
};
