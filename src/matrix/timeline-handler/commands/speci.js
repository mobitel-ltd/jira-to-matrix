const {fetchPostJSON} = require('../../../utils');
const {auth} = require('../../../jira');
const translate = require('../../../locales');
const {domain} = require('../../../config').matrix;
const {searchUser, BASE_URL} = require('./helper.js');
const {schemaWatcher} = require('./schemas.js');

const addUserInWatchers = async (room, roomName, user, matrixClient) => {
    const post = translate('successWatcherJira');
    matrixClient.sendHtmlMessage(room.roomId, post, post);

    let userIdMatrix = `@${user}:${domain}`;
    const members = room.getJoinedMembers();
    for (const {userId} of members) {
        if (userId === userIdMatrix) {
            userIdMatrix = null;
            break;
        }
    }

    if (userIdMatrix) {
        await matrixClient.invite(room.roomId, userIdMatrix);
    }

    return `User ${user} was added in watchers for issue ${roomName}`;
};

module.exports = async ({bodyText, room, roomName, matrixClient}) => {
    try {
        let user = bodyText;

        const status = await fetchPostJSON(
            `${BASE_URL}/${roomName}/watchers`,
            auth(),
            schemaWatcher(user)
        );

        if (status !== 204) {
            const users = await searchUser(user);
            let post;
            switch (users.length) {
                case 0: {
                    post = translate('errorWatcherJira');
                    matrixClient.sendHtmlMessage(room.roomId, post, post);

                    return `Watcher ${user} don't add in ${roomName} issue`;
                }
                case 1: {
                    user = users[0].name;

                    const status = await fetchPostJSON(
                        `${BASE_URL}/${roomName}/watchers`,
                        auth(),
                        schemaWatcher(users[0].name)
                    );

                    if (status !== 204) {
                        post = translate('errorWatcherJira');
                        matrixClient.sendHtmlMessage(room.roomId, post, post);
                        return `Watcher ${users[0].name} don't add in ${roomName} issue`;
                    }

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

        const inviteMessage = await addUserInWatchers(room, roomName, user, matrixClient);

        return inviteMessage;
    } catch (err) {
        throw ['Matrix spec command error', err].join('\n');
    }
};
