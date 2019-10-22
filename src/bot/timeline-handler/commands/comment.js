const jiraRequests = require('../../../lib/jira-request');
const translate = require('../../../locales');

module.exports = async ({ bodyText, sender, roomName }) => {
    if (bodyText) {
        await jiraRequests.postComment(roomName, sender, bodyText);

        return;
    }

    return translate('emptyMatrixComment');
};
