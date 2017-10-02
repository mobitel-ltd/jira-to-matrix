const jiraRequest = require('../utils');
const {auth} = require('../jira');
const logger = require('simple-color-logger')();

module.exports = async function(event, room, toStartOfTimeline) {
    if (event.getType() !== "m.room.message" || toStartOfTimeline) {
        return;
    }

    const command = await eventFromMatrix(event, room);
    if (command) {
        logger.info(command);
    }

    return;
}

const eventFromMatrix = async (event, room) => {
    const body = event.getContent().body;
    const op = body.match(/!\w*\b/g);

    if (!op) {
        return;
    }

    let roomName = room.getCanonicalAlias();
    roomName = roomName.substring(1, roomName.length - 21);
    let sender = event.getSender();
    sender = sender.substring(1, sender.length - 21);

    switch (op[0]) {
        case '!comment':
            const message = body.split(/!comment/i).join(' ');
    
            const jiraComment = await jiraRequest.fetchPostJSON(
                `https://jira.bingo-boom.ru/jira/rest/api/2/issue/${roomName}/comment`,
                auth(),
                schemaComment(sender, message)
            );

            return `Comment from ${sender} for ${roomName}`;
        case '!assign':
            const assignee = getAssgnee(event);

            const jiraAssign = await jiraRequest.fetchPutJSON(
                `https://jira.bingo-boom.ru/jira/rest/api/2/issue/${roomName}/assignee`,
                auth(),
                schemaAssignee(assignee)
            );

            if (jiraAssign.status !== 204) {
                return `User ${assignee} or room ${roomName} don't exist`;
            }
            return `The user ${assignee} now assignee issue ${roomName}\n(did ${sender})`;
        default:
            logger.warn(`The command ${op[0]} failed`);
            return;
    }
}

const schemaComment = (sender, message) => {
    const post = `[~${sender}]:\n${message}`
    return JSON.stringify({
        "body": post
    });
}

const schemaAssignee = (assignee) => {
    return JSON.stringify({
        "name": `${assignee}`
    });
}

const getAssgnee = (event) => {
    const body = event.getContent().body;
    if (body === '!assign') {
        const sender = event.getSender();
        return sender.substring(1, sender.length - 21);
    }

    return body.substring(8, body.length);
}
