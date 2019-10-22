const logger = require('../../modules/log.js')(module);
const redis = require('../../redis-client.js');
const { getLinkedIssue, getIssueSafety } = require('../../lib/jira-request.js');
const { getPostLinkMessageBody } = require('./helper');
const utils = require('../../lib/utils');

const postLink = async (key, relations, chatApi) => {
    const issue = await getIssueSafety(key);
    if (issue) {
        const roomID = await chatApi.getRoomId(key);

        const { body, htmlBody } = getPostLinkMessageBody(relations);
        await chatApi.sendHtmlMessage(roomID, body, htmlBody);
    }
};

const handleLink = chatApi => async issueLinkId => {
    try {
        if (!(await redis.isNewLink(issueLinkId))) {
            logger.debug(`link ${issueLinkId} is already been posted to room`);
            return;
        }

        const link = await getLinkedIssue(issueLinkId);
        const { inward, outward } = utils.getRelations(link);

        await postLink(utils.getOutwardLinkKey(link), inward, chatApi);
        await postLink(utils.getInwardLinkKey(link), outward, chatApi);
        logger.debug(`Issue link ${issueLinkId} is successfully posted!`);
    } catch (err) {
        throw utils.errorTracing('handleLink', err);
    }
};

module.exports = async ({ chatApi, links }) => {
    try {
        await Promise.all(links.map(handleLink(chatApi)));
        return true;
    } catch (err) {
        throw utils.errorTracing('post new link', err);
    }
};
