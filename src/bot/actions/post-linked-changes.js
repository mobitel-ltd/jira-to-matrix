const utils = require('../../lib/utils');
const jiraRequests = require('../../lib/jira-request');
const { getPostStatusData } = require('./helper.js');

const handler = (chatApi, data) => roomID => {
    const { body, htmlBody } = getPostStatusData(data);

    return chatApi.sendHtmlMessage(roomID, body, htmlBody);
};

module.exports = async ({ chatApi, linksKeys, data }) => {
    try {
        const checkedIssues = await Promise.all(
            linksKeys.map(async key => {
                const issue = await jiraRequests.getIssueSafety(key);

                return issue && key;
            }),
        );
        const availableIssues = checkedIssues.filter(Boolean);
        const roomIDs = await Promise.all(availableIssues.map(chatApi.getRoomIdForJoinedRoom.bind(chatApi)));

        await Promise.all(roomIDs.map(handler(chatApi, data)));

        return true;
    } catch (err) {
        throw utils.errorTracing('postLinkedChanges', err);
    }
};
