const logger = require('../modules/log.js')(module);
const {getIssue} = require('../lib/jira-request.js');
const {getPostLinkMessageBody} = require('./helper.js');
const utils = require('../lib/utils');

const postLink = async (key, related, relation, mclient) => {
    const roomID = await mclient.getRoomId(key);

    const {body, htmlBody} = getPostLinkMessageBody({relation, related}, 'deleteLink');
    await mclient.sendHtmlMessage(roomID, body, htmlBody);

    logger.debug(`Deleted Issue link in issue ${key} is successfully posted!`);
};

module.exports = async ({mclient, sourceIssueId, destinationIssueId, sourceRelation, destinationRelation}) => {
    try {
        const sourceIssue = await getIssue(sourceIssueId);
        const destinationIssue = await getIssue(destinationIssueId);

        await postLink(utils.getKey(sourceIssue), destinationIssue, sourceRelation, mclient);
        await postLink(utils.getKey(destinationIssue), sourceIssue, destinationRelation, mclient);

        return true;
    } catch (err) {
        throw utils.errorTracing('post delete link', err);
    }
};
