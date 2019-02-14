const translate = require('../../../locales');
const {searchUser, addToWatchers} = require('./helper.js');
const utils = require('../../../lib/utils');
const messages = require('../../../lib/messages');

module.exports = async ({bodyText, room, roomName, chatApi}) => {
    try {
        const users = await searchUser(bodyText);
        switch (users.length) {
            case 0: {
                const post = translate('errorWatcherJira');
                await chatApi.sendHtmlMessage(room.roomId, post, post);

                return messages.getWatcherNotAddedLog(bodyText);
            }
            case 1: {
                const [{name, displayName}] = users;

                await addToWatchers(room, roomName, name, chatApi);

                const post = translate('successWatcherJira');
                await chatApi.sendHtmlMessage(room.roomId, post, post);

                return messages.getWatcherAddedLog(displayName, roomName);
            }
            default: {
                const post = utils.getListToHTML(users);
                await chatApi.sendHtmlMessage(room.roomId, post, post);

                return;
            }
        }
    } catch (err) {
        if (err.includes('status is 403')) {
            const projectKey = utils.getProjectKeyFromIssueKey(roomName);
            const viewUrl = utils.getViewUrl(projectKey);
            const post = translate('setBotToAdmin', {projectKey, viewUrl});
            await chatApi.sendHtmlMessage(room.roomId, post, post);

            return post;
        }

        if (err.includes('status is 404')) {
            const post = translate('noRulesToWatchIssue');
            await chatApi.sendHtmlMessage(room.roomId, post, post);

            return post;
        }

        throw utils.errorTracing('Spec command', err);
    }
};
