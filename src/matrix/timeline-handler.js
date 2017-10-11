const logger = require('simple-color-logger')();
const jiraCommands = require('./jira-commands.js');
const matrixCommands = require('./matrix-commands.js');
const {t} = require('../locales');
const {postfix} = require('../config').matrix;

const eventFromMatrix = async (event, room, sender, self) => {
    const {body} = event.getContent();
    const op = body.match(/!\w*\b/);

    if (!op || op.index !== 0) {
        return;
    }

    logger.info(`${sender} sent message:\n ${body}`);

    let roomName = room.getCanonicalAlias();
    roomName = roomName.slice(1, -postfix);
    let message;

    switch (op[0]) {
        case '!comment':
            message = await jiraCommands.postComment(body, sender, room, roomName, self);
            break;
        case '!assign':
            message = await jiraCommands.appointAssignee(event, room, roomName, self);
            break;
        case '!move':
            message = await jiraCommands.issueMove(body, room, roomName, self);
            break;
        case '!spec':
            message = await jiraCommands.addWatchers(body, room, roomName, self);
            break;
        case '!op':
            message = await matrixCommands.upgradeUser(body, sender, room, roomName, self);
            break;
        case '!invite':
            message = await matrixCommands.inviteInRoom(body, sender, self);
            break;
        default:
            logger.warn(`The command ${op[0]} failed`);
            break;
    }

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
        const post = t('errorMatrixCommands');
        self.sendHtmlMessage(room.roomId, post, post);
        logger.error(err);
    }
};

module.exports = handler;
