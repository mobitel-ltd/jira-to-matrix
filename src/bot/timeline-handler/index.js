const logger = require('../../modules/log.js')(module);
const translate = require('../../locales');
const commands = require('./commands');

module.exports = async ({chatApi, sender, roomName, roomId, commandName, bodyText}) => {
    try {
        const command = commands[commandName];
        if (!command) {
            return;
        }
        const message = await command({bodyText, roomId, roomName, sender, chatApi});

        if (message) {
            await chatApi.sendHtmlMessage(roomId, message, message);
        }
        logger.debug(`${commandName} successfully executed by ${sender} in room ${roomName}`);

        return message;
    } catch (err) {
        const post = translate('errorMatrixCommands');
        await chatApi.sendHtmlMessage(roomId, post, post);
        logger.error(err);
    }
};


