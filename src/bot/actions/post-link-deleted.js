const { getIssueSafety } = require('../../lib/jira-request');
const { getPostLinkMessageBody } = require('./helper');
const utils = require('../../lib/utils');
const { getNoIssueLinkLog } = require('../../lib/messages');

const postLink = (roomID, related, relation, chatApi) => {
    if (roomID) {
        const { body, htmlBody } = getPostLinkMessageBody({ relation, related }, 'deleteLink');

        return chatApi.sendHtmlMessage(roomID, body, htmlBody);
    }
};

module.exports = async ({ chatApi, sourceIssueId, destinationIssueId, sourceRelation, destinationRelation }) => {
    try {
        const links = [sourceIssueId, destinationIssueId];
        const [sourceIssue, destinationIssue] = await Promise.all(links.map(getIssueSafety));
        if (!sourceIssue && !destinationIssue) {
            throw getNoIssueLinkLog(...links);
        }
        const [sourceIssueKey, destinationIssueKey] = [sourceIssue, destinationIssue].map(utils.getKey);

        const sourceIssueRoomId = sourceIssueKey && (await chatApi.getRoomId(sourceIssueKey));
        const destinationIssueRoomId = destinationIssueKey && (await chatApi.getRoomId(destinationIssueKey));

        await postLink(sourceIssueRoomId, destinationIssue, sourceRelation, chatApi);
        await postLink(destinationIssueRoomId, sourceIssue, destinationRelation, chatApi);

        return true;
    } catch (err) {
        throw utils.errorTracing('post delete link', err);
    }
};
