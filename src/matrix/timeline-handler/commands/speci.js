const translate = require('../../../locales');
const {searchUser, addToWatchers} = require('./helper.js');
const utils = require('../../../lib/utils');
const messages = require('../../../lib/messages');

module.exports = async ({bodyText, room, roomName, matrixClient}) => {
    try {
        const users = await searchUser(bodyText);
        switch (users.length) {
            case 0: {
                const post = translate('errorWatcherJira');
                await matrixClient.sendHtmlMessage(room.roomId, post, post);

                return messages.getWatcherNotAddedLog(bodyText);
            }
            case 1: {
                const [{name, displayName}] = users;

                await addToWatchers(room, roomName, name, matrixClient);

                const post = translate('successWatcherJira');
                await matrixClient.sendHtmlMessage(room.roomId, post, post);

                return messages.getWatcherAddedLog(displayName, roomName);
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

        throw utils.errorTracing('Spec command', err);
    }
};
