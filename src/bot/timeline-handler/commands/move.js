const jiraRequests = require('../../../lib/jira-request');
const translate = require('../../../locales');
const utils = require('../../../lib/utils');

module.exports = async ({bodyText, sender, roomName}) => {
    const transitions = await jiraRequests.getPossibleIssueStatuses(roomName);
    if (!bodyText) {
        return utils.getCommandList(transitions);
    }

    const newStatus = utils.getCommandAction(bodyText, transitions);

    if (!newStatus) {
        return translate('notFoundMove', {bodyText});
    }

    await jiraRequests.postIssueStatus(roomName, newStatus.id);

    return translate('successMoveJira', {...newStatus, sender});
};
