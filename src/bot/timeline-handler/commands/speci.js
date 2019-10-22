const translate = require('../../../locales');
const utils = require('../../../lib/utils');
const jiraRequests = require('../../../lib/jira-request');

module.exports = async ({ bodyText, roomId, roomName, chatApi }) => {
    try {
        const users = await jiraRequests.searchUser(bodyText);
        switch (users.length) {
            case 0: {
                return translate('errorWatcherJira');
            }
            case 1: {
                const [{ name }] = users;

                await jiraRequests.addWatcher(name, roomName);
                const userId = chatApi.getChatUserId(name);
                await chatApi.invite(roomId, userId);

                return translate('successWatcherJira');
            }
            default: {
                return utils.getListToHTML(users);
            }
        }
    } catch (err) {
        if (err.includes('status is 403')) {
            const projectKey = utils.getProjectKeyFromIssueKey(roomName);
            const viewUrl = utils.getViewUrl(projectKey);
            return translate('setBotToAdmin', { projectKey, viewUrl });
        }

        if (err.includes('status is 404')) {
            return translate('noRulesToWatchIssue');
        }

        throw utils.errorTracing('Spec command', err);
    }
};
