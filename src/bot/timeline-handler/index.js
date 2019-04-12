const logger = require('../../modules/log.js')(module);
const translate = require('../../locales');
const commands = require('./commands');

module.exports = async ({chatApi, sender, roomName, roomId, commandName, bodyText}) => {
    try {
        const params = {
            bodyText,
            roomId,
            roomName,
            sender,
            chatApi,
        };

        if (commands[commandName]) {
            const message = await commands[commandName](params);
            await chatApi.sendHtmlMessage(roomId, message, message);
            logger.debug(`${commandName}\n(did ${sender})`);

            return message;
        }

        logger.warn(`Command ${commandName} not found`);
    } catch (err) {
        const post = translate('errorMatrixCommands');
        await chatApi.sendHtmlMessage(roomId, post, post);
        logger.error(err);
    }
};


