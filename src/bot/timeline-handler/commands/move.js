const jiraRequests = require('../../../lib/jira-request');
const translate = require('../../../locales');
const utils = require('../../../lib/utils');

const getCommandAction = (val, collection) => {
    const numberVal = Number(val);
    if (Number.isInteger(numberVal)) {
        return collection[numberVal - 1];
    }
    const lowerVal = val.toLowerCase();

    return collection.find(({ name, to }) => name.toLowerCase() === lowerVal || to.name.toLowerCase() === lowerVal);
};

module.exports = async ({ bodyText, sender, roomName }) => {
    const transitions = await jiraRequests.getPossibleIssueStatuses(roomName);
    if (!bodyText) {
        return utils.getCommandList(transitions);
    }

    const newStatus = getCommandAction(bodyText, transitions);

    if (!newStatus) {
        return translate('notFoundMove', { bodyText });
    }

    await jiraRequests.postIssueStatus(roomName, newStatus.id);

    return translate('successMoveJira', { ...newStatus, sender });
};
