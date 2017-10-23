const jiraRequest = require('../../../utils');
const {auth} = require('../../../jira');
const translate = require('../../../locales');
const {postfix, domain} = require('../../../config').matrix;
const {schemaAssignee, schemaWatcher} = require('./schemas.js');
const {searchUser, BASE_URL} = require('./helper.js');

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
        `${BASE_URL}/${roomName}/watchers`,
        auth(),
        schemaWatcher(assignee)
    );

    const post = translate('successMatrixAssign', {assignee});
    await self.sendHtmlMessage(room.roomId, post, post);
    return `The user ${assignee} now assignee issue ${roomName}`;
};

module.exports = async ({event, room, roomName, self}) => {
    const assignee = getAssgnee(event);

    // appointed assignee for issue
    let jiraAssign = await jiraRequest.fetchPutJSON(
        `${BASE_URL}/${roomName}/assignee`,
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
                    `${BASE_URL}/${roomName}/assignee`,
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
