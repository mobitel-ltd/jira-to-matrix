const {requestPut} = require('../../../lib/request.js');
const translate = require('../../../locales');
const {schemaAssignee} = require('./schemas.js');
const {searchUser, BASE_URL, addToWatchers} = require('./helper.js');

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
                const [{displayName, name}] = users;
                await requestPut(
                    `${BASE_URL}/${roomName}/assignee`,
                    schemaAssignee(name)
                );

                await addToWatchers(room, roomName, name, matrixClient);

                const post = translate('successMatrixAssign', {displayName});
                await matrixClient.sendHtmlMessage(room.roomId, post, post);

                return `The user ${displayName} is assigned to issue ${roomName}`;
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
