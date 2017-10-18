/* eslint-disable no-use-before-define */
const jiraRequest = require('../utils');
const {auth} = require('../jira');
const translate = require('../locales');
const {postfix, domain} = require('../config').matrix;

const baseUrl = 'https://jira.bingo-boom.ru/jira/rest/api/2/issue';

const postComment = async (body, sender, room, roomName, self) => {
    const message = body.substring(9);

    // post comment in issue
    const jiraComment = await jiraRequest.fetchPostJSON(
        `${baseUrl}/${roomName}/comment`,
        auth(),
        schemaComment(sender, message)
    );

    if (jiraComment.status !== 201) {
        const post = translate('errorMatrixComment');
        await self.sendHtmlMessage(room.roomId, post, post);
        return `
            Comment from ${sender} for ${roomName} not published
            \nJira have status ${jiraComment.status}
        `;
    }

    const post = translate('successMatrixComment');
    await self.sendHtmlMessage(room.roomId, post, post);
    return `Comment from ${sender} for ${roomName}`;
};

const appointAssignee = async (event, room, roomName, self) => {
    const assignee = getAssgnee(event);

    // appointed assignee for issue
    const jiraAssign = await jiraRequest.fetchPutJSON(
        `${baseUrl}/${roomName}/assignee`,
        auth(),
        schemaAssignee(assignee)
    );

    if (jiraAssign.status !== 204) {
        const post = translate('errorMatrixAssign', {assignee});
        await self.sendHtmlMessage(room.roomId, post, post);
        return `User ${assignee} or issue ${roomName} don't exist`;
    }


    const inviteUser = getInviteUser(event, room);
    if (inviteUser) {
        await self.invite(room.roomId, inviteUser);
    }

    // add watcher for issue
    await jiraRequest.fetchPostJSON(
        `${baseUrl}/${roomName}/watchers`,
        auth(),
        schemaWatcher(assignee)
    );

    const post = translate('successMatrixAssign', {assignee});
    await self.sendHtmlMessage(room.roomId, post, post);
    return `The user ${assignee} now assignee issue ${roomName}`;
};

const getAssgnee = event => {
    const {body} = event.getContent();

    if (body === '!assign') {
        const sender = event.getSender();
        return sender.slice(1, -postfix);
    }

    // 8 it's length command "!assign"
    return body.substring(8);
};

const getInviteUser = (event, room) => {
    const {body} = event.getContent();
    if (body === '!assign') {
        return;
    }

    // 8 it's length command "!assign"
    let user = body.substring(8);
    user = `@${user}:${domain}`;

    // 'members' is an array of objects
    const members = room.getJoinedMembers();
    members.forEach(member => {
        if (member.userId === user) {
            user = null;
        }
    });

    return user;
};

const issueMove = async (body, room, roomName, self) => {
    const listCommands = await getListCommand(roomName);

    const moveId = listCommands.reduce((res, cur, index) => {
        // check command
        if (checkCommand(body, cur.name, index)) {
            return {id: cur.id, name: cur.name};
        }
        return res;
    }, 0);

    if (!moveId) {
        let postListCommands = listCommands.reduce(
            (res, cur, index) => `${res}&nbsp;&nbsp;${index + 1})&nbsp;${cur.name}<br>`,
            ''
        );
        postListCommands = `<b>${translate('listJiraCommand')}:</b><br>${postListCommands}`;
        await self.sendHtmlMessage(room.roomId, 'list commands', postListCommands);
        return;
    }

    // canged status issue
    const jiraMove = await jiraRequest.fetchPostJSON(
        `${baseUrl}/${roomName}/transitions`,
        auth(),
        schemaMove(moveId.id)
    );

    if (jiraMove.status !== 204) {
        const post = translate('errorMoveJira');
        await self.sendHtmlMessage(room.roomId, 'ERROR', post);
        return `Issue ${roomName} not changed status`;
    }

    const post = translate('successMoveJira', moveId);
    await self.sendHtmlMessage(room.roomId, post, post);
    return `Issue ${roomName} changed status`;
};

const getListCommand = async roomName => {
    // List of available commands
    const moveOptions = await jiraRequest.fetchJSON(
        `${baseUrl}/${roomName}/transitions`,
        auth()
    );

    return moveOptions.transitions.map(move => ({name: move.name, id: move.id}));
};

const checkCommand = (body, name, index) => Boolean(
    ~body.toLowerCase().indexOf(name.toLowerCase())
    || ~body.indexOf(String(index + 1))
);

const addWatchers = async (body, room, roomName, self) => {
    const user = body.substring(6).trim();

    await jiraRequest.fetchJSON(
        `https://jira.bingo-boom.ru/jira/rest/api/2/user?username=${user}`,
        auth()
    );

    const jiraWatcher = await jiraRequest.fetchPostJSON(
        `${baseUrl}/${roomName}/watchers`,
        auth(),
        schemaWatcher(user)
    );

    if (jiraWatcher.status !== 204) {
        const post = translate('errorWatcherJira');
        self.sendHtmlMessage(room.roomId, post, post);
        return `Watcher ${user} don't add in ${roomName} issue`;
    }

    const post = translate('successWatcherJira');
    self.sendHtmlMessage(room.roomId, post, post);

    let userId = `@${user}:${domain}`;
    const members = room.getJoinedMembers();
    members.forEach(member => {
        if (member.userId === userId) {
            userId = null;
        }
    });

    if (userId) {
        await self.invite(room.roomId, userId);
    }

    return `User ${user} was added in watchers for issue ${roomName}`;
};

const schemaComment = (sender, message) => {
    const body = `[~${sender}]:\n${message}`;
    return JSON.stringify({body});
};

const schemaAssignee = assignee => JSON.stringify({'name': `${assignee}`});

const schemaWatcher = watcher => `"${watcher}"`;

const schemaMove = id => JSON.stringify({
    'transition': {
        'id': id
    }
});

module.exports = {
    postComment,
    appointAssignee,
    issueMove,
    addWatchers,
};
