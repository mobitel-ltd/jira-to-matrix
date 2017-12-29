const {fetchPostJSON, fetchPutJSON} = require('../../../utils');
const {auth} = require('../../../jira');
const translate = require('../../../locales');
const {postfix, domain} = require('../../../config').matrix;
const {schemaAssignee, schemaWatcher} = require('./schemas.js');
const {searchUser, BASE_URL} = require('./helper.js');
const logger = require('../../../modules/log.js')(module);

const getAssignee = event => {
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
    try {
        const inviteUser = getInviteUser(assignee, room);
        if (inviteUser) {
            await matrixClient.invite(room.roomId, inviteUser);
        }

        // add watcher for issue
        const status = await fetchPostJSON(
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
    } catch (err) {
        logger.error('addAssigneeInWatchers error');

        throw err;
    }
};

module.exports = async ({event, room, roomName, matrixClient}) => {
    try {
        let assignee = getAssignee(event);

        // appointed assignee for issue
        const status = await fetchPutJSON(
            `${BASE_URL}/${roomName}/assignee`,
            auth(),
            schemaAssignee(assignee)
        );

        if (status !== 204) {
            const users = await searchUser(assignee);
            let post;
            switch (users.length) {
                case 0: {
                    post = translate('errorMatrixAssign', {assignee});
                    await matrixClient.sendHtmlMessage(room.roomId, post, post);

                    return `User ${assignee} or issue ${roomName} don't exist`;
                }
                case 1: {
                    const status = await fetchPutJSON(
                        `${BASE_URL}/${roomName}/assignee`,
                        auth(),
                        schemaAssignee(users[0].name)
                    );

                    if (status !== 204) {
                        throw new Error(`Jira returned status ${status} when try to add assignee`);
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
    } catch (err) {
        logger.error('Matrix assign command error');

        throw err;
    }
};
