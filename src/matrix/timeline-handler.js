const logger = require('simple-color-logger')();
const jiraCommands = require('./jira-commands.js');
const matrixCommands = require('./matrix-commands.js');
const {t} = require('../locales');
const {postfix} = require('../config').matrix;

const handler =  async function(event, room, toStartOfTimeline) {
    if (event.getType() !== "m.room.message" || toStartOfTimeline) {
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

        return;
    } catch(err) {
        const post = t('errorMatrixCommands');
        self.sendHtmlMessage(room.roomId, post, post);
        logger.error(err);
        return;
    }
}

const eventFromMatrix = async (event, room, sender, self) => {
    const body = event.getContent().body;
    const op = body.match(/!\w*\b/);

    if (!op || op.index !== 0) {
        return;
    }

    logger.info(`${sender} sent message:\n ${body}`);

    let roomName = room.getCanonicalAlias();
    roomName = roomName.slice(1, -postfix);

    switch (op[0]) {
        case '!comment':
            return await jiraCommands.postComment(body, sender, room, roomName, self);
        case '!assign':
            return await jiraCommands.appointAssignee(event, room, roomName, self);
        case '!move':
            return await jiraCommands.issueMove(body, room, roomName, self);
        case '!spec':
            return await jiraCommands.addWatchers(body, room, roomName, self);
        case '!op':
            return await matrixCommands.upgradeUser(body, sender, room, roomName, self);
        case '!invite':
            return await matrixCommands.inviteInRoom(body, sender, self);
        default:
            logger.warn(`The command ${op[0]} failed`);
            return;
    }
}

module.exports = handler;
