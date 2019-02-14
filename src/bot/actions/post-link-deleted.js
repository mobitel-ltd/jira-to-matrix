const logger = require('../../modules/log')(module);
const {getIssueSafety} = require('../../lib/jira-request');
const {getPostLinkMessageBody} = require('./helper');
const utils = require('../../lib/utils');
const {getNoIssueLinkLog} = require('../../lib/messages');

const postLink = async (key, related, relation, chatApi) => {
    if (!key) {
        return;
    }
    const roomID = await chatApi.getRoomId(key);

    const {body, htmlBody} = getPostLinkMessageBody({relation, related}, 'deleteLink');
    await chatApi.sendHtmlMessage(roomID, body, htmlBody);

    logger.debug(`Deleted Issue link in issue ${key} is successfully posted!`);
};

module.exports = async ({chatApi, sourceIssueId, destinationIssueId, sourceRelation, destinationRelation}) => {
    try {
        const links = [sourceIssueId, destinationIssueId];
        const [sourceIssue, destinationIssue] = await Promise.all(links.map(getIssueSafety));

        if (!sourceIssue && !destinationIssue) {
            throw getNoIssueLinkLog(...links);
        }

        await postLink(utils.getKey(sourceIssue), destinationIssue, sourceRelation, chatApi);
        await postLink(utils.getKey(destinationIssue), sourceIssue, destinationRelation, chatApi);

        return true;
    } catch (err) {
        throw utils.errorTracing('post delete link', err);
    }
};
