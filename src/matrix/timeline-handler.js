const jiraRequest = require('../utils');
const {auth} = require('../jira');
const logger = require('simple-color-logger')();
const {t} = require('../locales');

// postfix charsets in matrix names
// matrix sends "@jira_test:matrix.bingo-boom.ru"
// but i need only "jira_test"
const postfix = 21;

const objHas = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const handler =  async function(event, room, toStartOfTimeline) {
    if (event.getType() !== "m.room.message" || toStartOfTimeline) {
        return;
    }
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
            return await postComment(body, sender, room, roomName, self);
        case '!assign':
            return await appointAssignee(event, room, roomName, self);
        default:
            logger.warn(`The command ${op[0]} failed`);
            return;
    }
}

const postComment = async (body, sender, room, roomName, self) => {
    const message = body.split(/!comment/i).join(' ');
    
        // post comment in issue
        const jiraComment = await jiraRequest.fetchPostJSON(
            `https://jira.bingo-boom.ru/jira/rest/api/2/issue/${roomName}/comment`,
            auth(),
            schemaComment(sender, message)
        );

        if (jiraComment.status !== 201) {
            const post = t('errorMatrixComment');
            await self.sendHtmlMessage(room.roomId, post, post);
        }

        const post = t('successMatrixComment');
        await self.sendHtmlMessage(room.roomId, post, post);
        return `Comment from ${sender} for ${roomName}`;
}

const appointAssignee = async (event, room, roomName, self) => {
    const assignee = getAssgnee(event);
    
    // appointed assignee for issue
    const jiraAssign = await jiraRequest.fetchPutJSON(
        `https://jira.bingo-boom.ru/jira/rest/api/2/issue/${roomName}/assignee`,
        auth(),
        schemaAssignee(assignee)
    );

    if (jiraAssign.status !== 204) {
        const post = t('errorMatrixAssign', {assignee});
        await self.sendHtmlMessage(room.roomId, post, post);
        return `User ${assignee} or room ${roomName} don't exist`;
    } 


    const inviteUser = getInviteUser(event);
    if (inviteUser && !objHas(room.currentState.members, inviteUser)) {
        await self.invite(room.roomId, inviteUser);
    }

    const jiraWatcher = await jiraRequest.fetchPostJSON(
        `https://jira.bingo-boom.ru/jira/rest/api/2/issue/${roomName}/watchers`,
        auth(),
        schemaWatcher(assignee)
    );

    const post = t('successMatrixAssign', {assignee});
    await self.sendHtmlMessage(room.roomId, post, post);
    return `The user ${assignee} now assignee issue ${roomName}`;
}

const getInviteUser = (event) => {
    const body = event.getContent().body;
    if (body === '!assign') {
        return;
    }

    // 8 it's length command "!assign"
    const user = body.substring(8, body.length);
    return `@${user}:matrix.bingo-boom.ru`;
}

const getAssgnee = (event) => {
    const body = event.getContent().body;
    const postfix = 21;
    if (body === '!assign') {
        const sender = event.getSender();
        return sender.substring(1, sender.length - postfix);
    }

    // 8 it's length command "!assign"
    return body.substring(8, body.length);
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

const schemaWatcher = (assignee) => {
    return `"${assignee}"`;
}

module.exports = handler;
