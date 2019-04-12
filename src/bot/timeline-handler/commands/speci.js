const translate = require('../../../locales');
const utils = require('../../../lib/utils');
// const messages = require('../../../lib/messages');
const jiraRequests = require('../../../lib/jira-request');

module.exports = async ({bodyText, roomId, roomName, chatApi}) => {
    try {
        const users = await jiraRequests.searchUser(bodyText);
        switch (users.length) {
            case 0: {
                return translate('errorWatcherJira');
                // await chatApi.sendHtmlMessage(roomId, post, post);

                // return messages.getWatcherNotAddedLog(bodyText);
            }
            case 1: {
                const [{name}] = users;

                await jiraRequests.addWatcher(name, roomName);
                await chatApi.invite(roomId, name);


                return translate('successWatcherJira');
                // await chatApi.sendHtmlMessage(roomId, post, post);

                // return messages.getWatcherAddedLog(displayName, roomName);
            }
            default: {
                return utils.getListToHTML(users);
                // await chatApi.sendHtmlMessage(roomId, post, post);

                // return;
            }
        }
    } catch (err) {
        if (err.includes('status is 403')) {
            const projectKey = utils.getProjectKeyFromIssueKey(roomName);
            const viewUrl = utils.getViewUrl(projectKey);
            return translate('setBotToAdmin', {projectKey, viewUrl});
            // await chatApi.sendHtmlMessage(roomId, post, post);

            // return post;
        }

        if (err.includes('status is 404')) {
            return translate('noRulesToWatchIssue');
            // await chatApi.sendHtmlMessage(roomId, post, post);

            // return post;
        }

        throw utils.errorTracing('Spec command', err);
    }
};
