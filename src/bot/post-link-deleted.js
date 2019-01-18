const logger = require('../modules/log')(module);
const {getIssue} = require('../lib/jira-request');
const {getPostLinkMessageBody} = require('./helper');
const utils = require('../lib/utils');

const postLink = async (key, related, relation, mclient) => {
    if (!key) {
        return;
    }
    const roomID = await mclient.getRoomId(key);

    const {body, htmlBody} = getPostLinkMessageBody({relation, related}, 'deleteLink');
    await mclient.sendHtmlMessage(roomID, body, htmlBody);

    logger.debug(`Deleted Issue link in issue ${key} is successfully posted!`);
};

const getLinkedIssue = async id => {
    try {
        const issue = await getIssue(id);
        return issue;
    } catch (err) {
        return false;
    }
};

module.exports = async ({mclient, sourceIssueId, destinationIssueId, sourceRelation, destinationRelation}) => {
    try {
        const [sourceIssue, destinationIssue] =
            await Promise.all([sourceIssueId, destinationIssueId].map(getLinkedIssue));

        if (!sourceIssue) {
            throw 'Cannot get no one issue to info about deleting link';
        }
        await postLink(utils.getKey(sourceIssue), destinationIssue, sourceRelation, mclient);
        await postLink(utils.getKey(destinationIssue), sourceIssue, destinationRelation, mclient);

        return true;
    } catch (err) {
        throw utils.errorTracing('post delete link', err);
    }
};
