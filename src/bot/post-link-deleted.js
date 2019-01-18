const logger = require('../modules/log')(module);
const {getIssueSafety} = require('../lib/jira-request');
const {getPostLinkMessageBody} = require('./helper');
const utils = require('../lib/utils');
const {getNoIssueLinkLog} = require('../lib/messages');

const postLink = async (key, related, relation, mclient) => {
    if (!key) {
        return;
    }
    const roomID = await mclient.getRoomId(key);

    const {body, htmlBody} = getPostLinkMessageBody({relation, related}, 'deleteLink');
    await mclient.sendHtmlMessage(roomID, body, htmlBody);

    logger.debug(`Deleted Issue link in issue ${key} is successfully posted!`);
};

module.exports = async ({mclient, sourceIssueId, destinationIssueId, sourceRelation, destinationRelation}) => {
    try {
        const links = [sourceIssueId, destinationIssueId];
        const [sourceIssue, destinationIssue] = await Promise.all(links.map(getIssueSafety));

        if (!sourceIssue && !destinationIssue) {
            throw getNoIssueLinkLog(...links);
        }

        await postLink(utils.getKey(sourceIssue), destinationIssue, sourceRelation, mclient);
        await postLink(utils.getKey(destinationIssue), sourceIssue, destinationRelation, mclient);

        return true;
    } catch (err) {
        throw utils.errorTracing('post delete link', err);
    }
};
