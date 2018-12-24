const logger = require('../modules/log.js')(module);
const {getLinkedIssue} = require('../lib/jira-request.js');
const {getPostLinkMessageBody} = require('./helper.js');
const utils = require('../lib/utils');

const postLink = async (key, relations, mclient) => {
    const roomID = await mclient.getRoomId(key);

    const {body, htmlBody} = getPostLinkMessageBody(relations, 'deleteLink');
    await mclient.sendHtmlMessage(roomID, body, htmlBody);
};

const handleLink = mclient => async issueLinkId => {
    try {
        const link = await getLinkedIssue(issueLinkId);
        const {inward, outward} = utils.getRelations(link);

        await postLink(utils.getOutwardLinkKey(link), inward, mclient);
        await postLink(utils.getInwardLinkKey(link), outward, mclient);
        logger.debug(`Issue link ${issueLinkId} is successfully posted!`);
    } catch (err) {
        throw ['HandleLink error in delete link', err].join('\n');
    }
};

module.exports = async ({mclient, links}) => {
    try {
        await Promise.all(links.map(handleLink(mclient)));

        return true;
    } catch (err) {
        throw utils.errorTracing('post delete link');
    }
};
