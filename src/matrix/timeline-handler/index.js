const logger = require('../../modules/log.js')(module);
const translate = require('../../locales');
const {postfix} = require('../../config').matrix;
const commands = require('./commands');
const {parseEventBody} = require('./commands/helper.js');

const eventFromMatrix = async (event, room, sender, matrixClient) => {
    try {
        const {body} = event.getContent();

        const {commandName, bodyText} = parseEventBody(body);

        if (!commandName) {
            return;
        }

        const roomName = room.getCanonicalAlias().slice(1, -postfix);

        const params = {
            bodyText,
            event,
            room,
            body,
            roomName,
            sender,
            matrixClient,
        };

        if (commands[commandName]) {
            const message = await commands[commandName](params);

            return message;
        }

        logger.warn(`Command ${commandName} not found`);
    } catch (err) {
        throw ['Error in event handling', err].join('\n');
    }
};

const handler = async function Handler(event, room, toStartOfTimeline) {
    if (event.getType() !== 'm.room.message' || toStartOfTimeline) {
        return;
    }

    // matrixClient
    const self = this;

    const sender = event.getSender().slice(1, -postfix);

    try {
        const command = await eventFromMatrix(event, room, sender, self);
        if (command) {
            logger.debug(`${command}\n(did ${sender})`);
        }
    } catch (err) {
        const post = translate('errorMatrixCommands');
        self.sendHtmlMessage(room.roomId, post, post);
        logger.error(err);
    }
};

module.exports = handler;
