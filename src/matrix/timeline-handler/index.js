const logger = require('simple-color-logger')();
// const jiraCommands = require('./jira-commands.js');
// const matrixCommands = require('./matrix-commands.js');
const translate = require('../../locales');
const {postfix} = require('../../config').matrix;
const commands = require('./commands');

const eventFromMatrix = async (event, room, sender, self) => {
    const {body} = event.getContent();
    const op = body.match(/!\w*\b/);

    if (!op || op.index !== 0) {
        return;
    }

    logger.info(`${sender} sent message:\n ${body}`);

    let roomName = room.getCanonicalAlias();
    roomName = roomName.slice(1, -postfix);

    const params = {
        event,
        room,
        body,
        roomName,
        sender,
        self,
    };

    const message = await commands[op[0]](params);
    return message;
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
