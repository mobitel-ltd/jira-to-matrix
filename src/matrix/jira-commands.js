/* eslint-disable no-use-before-define */
const jiraRequest = require('../utils');
const {auth} = require('../jira');
const translate = require('../locales');
const {postfix, domain} = require('../config').matrix;

const baseUrl = 'https://jira.bingo-boom.ru/jira/rest/api/2/issue';

const chekUser = (users, name) =>
    ~users.name.toLowerCase().indexOf(name.toLowerCase())
    || ~users.displayName.toLowerCase().indexOf(name.toLowerCase());

const searchUser = async name => {
    const allUsers = await jiraRequest.fetchJSON(
        `https://jira.bingo-boom.ru/jira/rest/api/2/user/search?maxResults=1000&username=@boom`,
        auth()
    );

    const result = allUsers.reduce((prev, cur) => {
        if (chekUser(cur, name)) {
            prev.push(cur);
        }

        return prev;
    }, []);

    return result;
};

const postComment = async (body, sender, room, roomName, self) => {
    const message = body.substring(9).trim();

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
    let jiraAssign = await jiraRequest.fetchPutJSON(
        `${baseUrl}/${roomName}/assignee`,
        auth(),
        schemaAssignee(assignee)
    );

    let inviteMessage;
    if (jiraAssign.status !== 204) {
        const users = await searchUser(assignee);
        let post;
        switch (users.length) {
            case 0:
                post = translate('errorMatrixAssign', {assignee});
                await self.sendHtmlMessage(room.roomId, post, post);

                return `User ${assignee} or issue ${roomName} don't exist`;
            case 1:
                jiraAssign = await jiraRequest.fetchPutJSON(
                    `${baseUrl}/${roomName}/assignee`,
                    auth(),
                    schemaAssignee(users[0].name)
                );

                inviteMessage = await addAssigneeInWatchers(room, roomName, users[0].name, self);
                return inviteMessage;
            default:
                post = users.reduce(
                    (prev, cur) => `${prev}<strong>${cur.name}</strong> - ${cur.displayName}<br>`,
                    'List users:<br>');

                await self.sendHtmlMessage(room.roomId, 'List users', post);
                return;
        }
    }

    inviteMessage = await addAssigneeInWatchers(room, roomName, assignee, self);
    return inviteMessage;
};

const getAssgnee = event => {
    const {body} = event.getContent();

    if (body === '!assign') {
        const sender = event.getSender();
        return sender.slice(1, -postfix);
    }

    // 8 it's length command "!assign"
    return body.substring(8).trim();
};

const getInviteUser = (assignee, room) => {
    let user = `@${assignee}:${domain}`;

    // 'members' is an array of objects
    const members = room.getJoinedMembers();
    members.forEach(member => {
        if (member.userId === user) {
            user = null;
        }
    });

    return user;
};

const addAssigneeInWatchers = async (room, roomName, assignee, self) => {
    const inviteUser = getInviteUser(assignee, room);
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

const checkCommand = (body, name, index) =>
    ~body.toLowerCase().indexOf(name.toLowerCase())
    || ~body.indexOf(String(index + 1));

const getListCommand = async roomName => {
    // List of available commands
    const {transitions} = await jiraRequest.fetchJSON(
        `${baseUrl}/${roomName}/transitions`,
        auth()
    );

    return transitions.map(move => ({name: move.name, id: move.id}));
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

const addUserInWatchers = async (room, roomName, user, self) => {
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

const addWatchers = async (body, room, roomName, self) => {
    const user = body.substring(6).trim();

    let jiraWatcher = await jiraRequest.fetchPostJSON(
        `${baseUrl}/${roomName}/watchers`,
        auth(),
        schemaWatcher(user)
    );

    let inviteMessage;
    if (jiraWatcher.status !== 204) {
        const users = await searchUser(user);
        let post;
        switch (users.length) {
            case 0:
                post = translate('errorWatcherJira');
                self.sendHtmlMessage(room.roomId, post, post);
                return `Watcher ${user} don't add in ${roomName} issue`;
            case 1:
                jiraWatcher = await jiraRequest.fetchPostJSON(
                    `${baseUrl}/${roomName}/watchers`,
                    auth(),
                    schemaWatcher(users[0].name)
                );
                if (jiraWatcher.status !== 204) {
                    post = translate('errorWatcherJira');
                    self.sendHtmlMessage(room.roomId, post, post);
                    return `Watcher ${users[0].name} don't add in ${roomName} issue`;
                }
                inviteMessage = await addUserInWatchers(room, roomName, users[0].name, self);
                return inviteMessage;
            default:
                post = users.reduce(
                    (prev, cur) => `${prev}<strong>${cur.name}</strong> - ${cur.displayName}<br>`,
                    'List users:<br>');

                await self.sendHtmlMessage(room.roomId, 'List users', post);
                return;
        }
    }

    inviteMessage = await addUserInWatchers(room, roomName, user, self);
    return inviteMessage;
};

const chekNamePriority = (priority, index, name) =>
    priority.name.toLowerCase() === name.toLowerCase()
    || String(index + 1) === name;

const setPrio = async (body, room, roomName, self) => {
    const prioName = body.substring(6).trim();

    const {fields} = await jiraRequest.fetchJSON(
        `${baseUrl}/${roomName}/editmeta`,
        auth()
    );
    const prioritys = fields.priority.allowedValues;

    const priority = prioritys.reduce((prev, cur, index) => {
        if (chekNamePriority(cur, index, prioName)) {
            return {id: cur.id, name: cur.name};
        }
        return prev;
    }, 0);

    if (!priority) {
        const listPrio = prioritys.reduce(
            (prev, cur, index) => `${prev}${index + 1}) ${cur.name}<br>`,
            ''
        );
        await self.sendHtmlMessage(room.roomId, 'List prioritys', listPrio);
        return;
    }

    await jiraRequest.fetchPutJSON(
        `${baseUrl}/${roomName}`,
        auth(),
        shemaFields(priority.id)
    );

    const post = translate('setPriority', priority);
    await self.sendHtmlMessage(room.roomId, 'Successful set priority', post);

    return `Issue ${roomName} now has priority ${priority.name}`;
};

const schemaComment = (sender, message) => {
    const body = `[~${sender}]:\n${message}`;
    return JSON.stringify({body});
};

const schemaAssignee = assignee => JSON.stringify({'name': `${assignee}`});

const schemaWatcher = watcher => `"${watcher}"`;
/* eslint-disable comma-dangle */
const schemaMove = id => JSON.stringify({
    'transition': {
        id
    }
});

const shemaFields = id => JSON.stringify({
    'fields': {
        'priority': {
            id
        }
    }
});

module.exports = {
    postComment,
    appointAssignee,
    issueMove,
    addWatchers,
    setPrio,
};
