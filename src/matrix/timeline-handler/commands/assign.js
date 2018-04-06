const {requestPost, requestPut} = require('../../../utils');
const {auth} = require('../../../jira');
const translate = require('../../../locales');
const {domain} = require('../../../config').matrix;
const {schemaAssignee, schemaWatcher} = require('./schemas.js');
const {searchUser, BASE_URL} = require('./helper.js');

const getInviteUser = (assignee, room) => {
    const user = `@${assignee}:${domain}`;
    const members = room.getJoinedMembers();
    const isInRoom = members.find(({userId}) => userId === user);

    return isInRoom ? false : user;
};

const addAssigneeInWatchers = async (room, roomName, {name, displayName}, matrixClient) => {
    try {
        const inviteUser = getInviteUser(name, room);
        if (inviteUser) {
            await matrixClient.invite(room.roomId, inviteUser);
        }

        // add watcher for issue
        await requestPost(
            `${BASE_URL}/${roomName}/watchers`,
            auth(),
            schemaWatcher(name)
        );

        const post = translate('successMatrixAssign', {displayName});
        await matrixClient.sendHtmlMessage(room.roomId, post, post);

        return `The user ${displayName} is assigned to issue ${roomName}`;
    } catch (err) {
        throw ['addAssigneeInWatchers error', err].join('\n');
    }
};

module.exports = async ({body, sender, room, roomName, matrixClient}) => {
    try {
        const userToFind = body === '!assign' ? sender : body.substring(8).trim();
        const users = await searchUser(userToFind);

        switch (users.length) {
            case 0: {
                const post = translate('errorMatrixAssign', {userToFind});
                await matrixClient.sendHtmlMessage(room.roomId, post, post);

                return `User ${userToFind} or issue ${roomName} is not exist`;
            }
            case 1: {
                const [user] = users;
                await requestPut(
                    `${BASE_URL}/${roomName}/assignee`,
                    auth(),
                    schemaAssignee(user.name)
                );

                const inviteMessage = await addAssigneeInWatchers(room, roomName, user, matrixClient);

                return inviteMessage;
            }
            default: {
                const post = users.reduce(
                    (prev, cur) => `${prev}<strong>${cur.name}</strong> - ${cur.displayName}<br>`,
                    'List users:<br>');

                await matrixClient.sendHtmlMessage(room.roomId, 'List users', post);
                return;
            }
        }
    } catch (err) {
        throw ['Matrix assign command error', err].join('\n');
    }
};
