const logger = require('../../modules/log.js')(module);
const translate = require('../../locales');
const {postfix} = require('../../config').matrix;
const commands = require('./commands');
const {parseEventBody} = require('./commands/helper.js');


const eventFromMatrix = async (event, room, sender, matrixClient) => {
    // logger.debug('\nroom', room);
    // logger.debug('\nsender', sender);

    try {
        logger.debug('event.getContent()', event.getContent());
        const {body} = event.getContent();
        logger.debug('body', body);

        const {commandName, bodyText} = parseEventBody(body);

        if (!commandName) {
            logger.info(`${sender} sent message:\n ${body}`);

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
        logger.error('Error in event handling');

        throw err;
    }
};

const handler = async function Handler(event, room, toStartOfTimeline) {
    if (event.getType() !== 'm.room.message' || toStartOfTimeline) {
        return;
    }

    // matrixClient
    const self = this;

    let sender = event.getSender();
    sender = sender.slice(1, -postfix);

    try {
        const command = await eventFromMatrix(event, room, sender, self);
        if (command) {
            logger.info(`${command}\n(did ${sender})`);
        }
    } catch (err) {
        const post = translate('errorMatrixCommands');
        self.sendHtmlMessage(room.roomId, post, post);
        logger.error(err);
    }
};

module.exports = handler;
