const logger = require('../../modules/log.js')(module);
const redis = require('../../redis-client');
const { getIssue } = require('../../lib/jira-request.js');
const { getNewIssueMessageBody, getPostStatusData } = require('./helper.js');
const utils = require('../../lib/utils');

const getParentLink = async (parent, child) => {
    const redisEpicKey = utils.getRedisParentKey(parent.id);
    if (await redis.hasChild(redisEpicKey, child.id)) {
        logger.debug(`Issue ${child.key} already saved in Redis by parent ${parent.key}`);

        return false;
    }

    return redisEpicKey;
};

module.exports = async ({ chatApi, parentKey, childData }) => {
    try {
        const parentRoomId = await chatApi.getRoomId(parentKey);
        const parentData = await getIssue(parentKey);
        const parentLink = await getParentLink(parentData, childData);

        if (parentLink) {
            await redis.saveToEpic(parentLink, childData.id);
            const { body, htmlBody } = getNewIssueMessageBody(childData, 'Parent');
            logger.info(`Info about issue ${childData.key} added to parent ${parentKey}`);

            await chatApi.sendHtmlMessage(parentRoomId, body, htmlBody);
        }

        if (childData.status) {
            const { body, htmlBody } = getPostStatusData(childData);
            await chatApi.sendHtmlMessage(parentRoomId, body, htmlBody);
        }

        return true;
    } catch (err) {
        throw ['Error in postParentUpdates', err].join('\n');
    }
};
