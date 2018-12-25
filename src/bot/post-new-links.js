const logger = require('../modules/log.js')(module);
const redis = require('../redis-client.js');
const {getLinkedIssue} = require('../lib/jira-request.js');
const {getPostLinkMessageBody} = require('./helper');
const utils = require('../lib/utils');

const postLink = async (key, relations, mclient) => {
    const roomID = await mclient.getRoomId(key);

    const {body, htmlBody} = getPostLinkMessageBody(relations);
    await mclient.sendHtmlMessage(roomID, body, htmlBody);
};

const handleLink = mclient => async issueLinkId => {
    try {
        if (!(await redis.isNewLink(issueLinkId))) {
            logger.debug(`link ${issueLinkId} is already been posted to room`);
            return;
        }

        const link = await getLinkedIssue(issueLinkId);
        const {inward, outward} = utils.getRelations(link);

        await postLink(utils.getOutwardLinkKey(link), inward, mclient);
        await postLink(utils.getInwardLinkKey(link), outward, mclient);
        logger.debug(`Issue link ${issueLinkId} is successfully posted!`);
    } catch (err) {
        throw utils.errorTracing('handleLink');
    }
};

module.exports = async ({mclient, links}) => {
    try {
        await Promise.all(links.map(handleLink(mclient)));
        return true;
    } catch (err) {
        throw utils.errorTracing('post new link');
    }
};
