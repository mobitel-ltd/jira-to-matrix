const {requestPost, requestPut} = require('../../../utils');
const {auth} = require('../../../jira');
const translate = require('../../../locales');
const {domain} = require('../../../config').matrix;
const {schemaAssignee, schemaWatcher} = require('./schemas.js');
const {searchUser, BASE_URL} = require('./helper.js');
const logger = require('../../../modules/log.js')(module);

const getInviteUser = (assignee, room) => {
    const user = `@${assignee}:${domain}`;
    logger.debug(user);
    const members = room.getJoinedMembers();
    logger.debug(members);
    const isInRoom = members.find(({userId}) => userId === user);

    return isInRoom ? false : user;
};

const addAssigneeInWatchers = async (room, roomName, user, matrixClient) => {
    try {
        const inviteUser = getInviteUser(user, room);
        logger.debug(inviteUser);
        if (inviteUser) {
            await matrixClient.invite(room.roomId, inviteUser);
        }

        // add watcher for issue
        await requestPost(
            `${BASE_URL}/${roomName}/watchers`,
            auth(),
            schemaWatcher(user)
        );

        const post = translate('successMatrixAssign', {user});
        await matrixClient.sendHtmlMessage(room.roomId, post, post);

        return `The user ${user} now assignee issue ${roomName}`;
    } catch (err) {
        throw ['addAssigneeInWatchers error', err].join('\n');
    }
};

module.exports = async ({body, sender, room, roomName, matrixClient}) => {
    try {
        const userToFind = body === '!assign' ? sender : body.substring(8).trim();

        const users = await searchUser(userToFind);
        logger.debug(users);
        switch (users.length) {
            case 0: {
                const post = translate('errorMatrixAssign', {userToFind});
                await matrixClient.sendHtmlMessage(room.roomId, post, post);

                return `User ${userToFind} or issue ${roomName} is not exist`;
            }
            case 1: {
                await requestPut(
                    `${BASE_URL}/${roomName}/assignee`,
                    auth(),
                    schemaAssignee(users[0].name)
                );

                const [{name}] = users;
                const inviteMessage = await addAssigneeInWatchers(room, roomName, name, matrixClient);

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
        logger.error(err);
        throw ['Matrix assign command error', err].join('\n');
    }
};
