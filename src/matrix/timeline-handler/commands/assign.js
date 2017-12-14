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
    for (const {userId} of members) {
        if (userId === user) {
            user = null;
            break;
        }
    }

    return user;
};

const addAssigneeInWatchers = async (room, roomName, assignee, matrixClient) => {
    const inviteUser = getInviteUser(assignee, room);
    if (inviteUser) {
        await matrixClient.invite(room.roomId, inviteUser);
    }

    // add watcher for issue
    const {status} = await jiraRequest.fetchPostJSON(
        `${BASE_URL}/${roomName}/watchers`,
        auth(),
        schemaWatcher(assignee)
    );

    if (status !== 204) {
        throw new Error(`Jira returned status ${status} when try to add watcher`);
    }

    const post = translate('successMatrixAssign', {assignee});
    await matrixClient.sendHtmlMessage(room.roomId, post, post);
    return `The user ${assignee} now assignee issue ${roomName}`;
};

module.exports = async ({event, room, roomName, matrixClient}) => {
    let assignee = getAssgnee(event);

    // appointed assignee for issue
    let jiraAssign = await jiraRequest.fetchPutJSON(
        `${BASE_URL}/${roomName}/assignee`,
        auth(),
        schemaAssignee(assignee)
    );

    if (jiraAssign.status !== 204) {
        const users = await searchUser(assignee);
        let post;
        switch (users.length) {
            case 0: {
                post = translate('errorMatrixAssign', {assignee});
                await matrixClient.sendHtmlMessage(room.roomId, post, post);

                return `User ${assignee} or issue ${roomName} don't exist`;
            }
            case 1: {
                jiraAssign = await jiraRequest.fetchPutJSON(
                    `${BASE_URL}/${roomName}/assignee`,
                    auth(),
                    schemaAssignee(users[0].name)
                );

                if (jiraAssign.status !== 204) {
                    throw new Error(`Jira returned status ${jiraAssign.status} when try to add assignee`);
                }

                assignee = users[0].name;
                break;
            }
            default: {
                post = users.reduce(
                    (prev, cur) => `${prev}<strong>${cur.name}</strong> - ${cur.displayName}<br>`,
                    'List users:<br>');

                await matrixClient.sendHtmlMessage(room.roomId, 'List users', post);
                return;
            }
        }
    }

    const inviteMessage = await addAssigneeInWatchers(room, roomName, assignee, matrixClient);
    return inviteMessage;
};