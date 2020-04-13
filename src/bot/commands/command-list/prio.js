const jiraRequests = require('../../../lib/jira-request');
const translate = require('../../../locales');
const utils = require('../../../lib/utils');

const getCommandAction = (val, collection) => {
    const numberVal = Number(val);
    if (Number.isInteger(numberVal)) {
        return collection[numberVal - 1];
    }

    return collection.find(el => el.name.toLowerCase() === val.toLowerCase());
};

module.exports = async ({ bodyText, roomId, roomName, chatApi }) => {
    const allPriorities = await jiraRequests.getIssuePriorities(roomName);
    if (!allPriorities) {
        return translate('notPrio');
    }

    if (!bodyText) {
        return utils.getCommandList(allPriorities);
    }

    const priority = getCommandAction(bodyText, allPriorities);

    if (!priority) {
        return translate('notFoundPrio', { bodyText });
    }

    await jiraRequests.updateIssuePriority(roomName, priority.id);

    return translate('setPriority', priority);
};
