const utils = require('../../../lib/utils');
const translate = require('../../../locales');
const {searchUser, addToAssignee} = require('./helper.js');
const messages = require('../../../lib/messages');

module.exports = async ({bodyText, sender, room, roomName, matrixClient}) => {
    try {
        const userToFind = bodyText || sender;
        const users = await searchUser(userToFind);

        switch (users.length) {
            case 0: {
                const post = translate('errorMatrixAssign', {userToFind});
                await matrixClient.sendHtmlMessage(room.roomId, post, post);

                return messages.getAssigneeNotAddedLog(userToFind, roomName);
            }
            case 1: {
                const [{displayName, name}] = users;

                await addToAssignee(room, roomName, name, matrixClient);

                const post = translate('successMatrixAssign', {displayName});
                await matrixClient.sendHtmlMessage(room.roomId, post, post);

                return messages.getAssigneeAddedLog(displayName, roomName);
            }
            default: {
                const post = utils.getListToHTML(users);
                await matrixClient.sendHtmlMessage(room.roomId, 'List users', post);

                return;
            }
        }
    } catch (err) {
        if (err.includes('status is 403')) {
            const post = translate('setBotToAdmin');
            await matrixClient.sendHtmlMessage(room.roomId, post, post);

            return post;
        }

        if (err.includes('status is 404')) {
            const post = translate('noRulesToWatchIssue');
            await matrixClient.sendHtmlMessage(room.roomId, post, post);

            return post;
        }

        throw utils.errorTracing('Assign command', err);
    }
};
