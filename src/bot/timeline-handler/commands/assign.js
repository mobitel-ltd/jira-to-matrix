const utils = require('../../../lib/utils');
const translate = require('../../../locales');
// const messages = require('../../../lib/messages');
const jiraRequests = require('../../../lib/jira-request');

module.exports = async ({bodyText, sender, roomName, chatApi, roomId}) => {
    try {
        const userToFind = bodyText || sender;
        const users = await jiraRequests.searchUser(userToFind);

        switch (users.length) {
            case 0: {
                return translate('errorMatrixAssign', {userToFind});
            }
            case 1: {
                const [{displayName, name}] = users;

                await jiraRequests.addAssignee(name, roomName);
                const userId = chatApi.getChatUserId(name);
                await chatApi.invite(roomId, userId);

                return translate('successMatrixAssign', {displayName});
            }
            default: {
                return utils.getListToHTML(users);
            }
        }
    } catch (err) {
        if (typeof err === 'string') {
            if (err.includes('status is 403')) {
                return translate('setBotToAdmin');
            }

            if (err.includes('status is 404')) {
                return translate('noRulesToWatchIssue');
            }

            throw utils.errorTracing('Assign command', err);
        }

        throw err;
    }
};
