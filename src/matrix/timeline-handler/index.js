const logger = require('debug')('matrix timeline handler');
// const jiraCommands = require('./jira-commands.js');
// const matrixCommands = require('./matrix-commands.js');
const translate = require('../../locales');
const {postfix} = require('../../config').matrix;
const commands = require('./commands');

const eventFromMatrix = async (event, room, sender, matrixClient) => {
    const {body} = event.getContent();
    const command = body.match(/!\w+\b/);

    if (!command || command.index !== 0) {
        return;
    }

    logger(`${sender} sent message:\n ${body}`);

    let roomName = room.getCanonicalAlias();
    roomName = roomName.slice(1, -postfix);
    const commandName = command[0].substring(1);

    const params = {
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
            logger(`${command}\n(did ${sender})`);
        }
    } catch (err) {
        const post = translate('errorMatrixCommands');
        self.sendHtmlMessage(room.roomId, post, post);
        logger(err);
    }
};

module.exports = handler;
