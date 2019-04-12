const jiraRequests = require('../../../lib/jira-request');
const translate = require('../../../locales');
const utils = require('../../../lib/utils');

module.exports = async ({bodyText, roomId, roomName, chatApi}) => {
    const allPriorities = await jiraRequests.getIssuePriorities(roomName);

    if (!bodyText) {
        return utils.getCommandList(allPriorities);
    }

    const priority = utils.getCommandAction(bodyText, allPriorities);

    if (!priority) {
        return translate('notFoundPrio', {bodyText});
    }

    await jiraRequests.updateIssuePriority(roomName, priority.id);

    return translate('setPriority', priority);
};
