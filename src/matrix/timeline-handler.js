const logger = require('simple-color-logger')();
const jiraCommands = require('./jira-commands.js');
const conf = require('../config');

// postfix charsets in matrix names
// matrix sends "@jira_test:matrix.bingo-boom.ru"
// but i need only "jira_test"
const postfix = conf.matrix.domain.length + 1;

const handler =  async function(event, room, toStartOfTimeline) {
    if (event.getType() !== "m.room.message" || toStartOfTimeline) {
        return;
    }

    // matrixClient
    const self = this;
    
    let sender = event.getSender();
    sender = sender.substring(1, sender.length - postfix);

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
    const op = body.match(/!\w*\b/g);

    if (!op) {
        return;
    }

    let roomName = room.getCanonicalAlias();
    roomName = roomName.substring(1, roomName.length - postfix);

    switch (op[0]) {
        case '!comment':
            return await jiraCommands.postComment(body, sender, room, roomName, self);
        case '!assign':
            return await jiraCommands.appointAssignee(event, room, roomName, self);
        case '!move':
            return await jiraCommands.issueMove(body, room, roomName, self);
        default:
            logger.warn(`The command ${op[0]} failed`);
            return;
    }
}

module.exports = handler;
