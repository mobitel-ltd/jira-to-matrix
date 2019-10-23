const logger = require('../../modules/log.js')(module);
const redis = require('../../redis-client');
const { getIssue } = require('../../lib/jira-request.js');
const { epicUpdates: epicConf } = require('../../config').features;
const { getNewIssueMessageBody, getPostStatusData } = require('./helper.js');
const utils = require('../../lib/utils');

const postNewIssue = async (roomID, { epic, issue }, chatApi) => {
    const redisEpicKey = utils.getRedisEpicKey(epic.id);
    if (await redis.isInEpic(redisEpicKey, issue.id)) {
        logger.debug(`Issue ${issue.key} already saved in Redis by epic ${epic.key}`);

        return;
    }

    const { body, htmlBody } = getNewIssueMessageBody(issue);
    await redis.saveToEpic(redisEpicKey, issue.id);
    logger.info(`Info about issue ${issue.key} added to epic ${epic.key}`);

    await chatApi.sendHtmlMessage(roomID, body, htmlBody);
};

module.exports = async ({ chatApi, data, epicKey }) => {
    try {
        const roomID = await chatApi.getRoomId(epicKey);
        const epic = await getIssue(epicKey);

        if (epicConf.newIssuesInEpic === 'on') {
            await postNewIssue(roomID, { epic, issue: data }, chatApi);
        }
        if (epicConf.issuesStatusChanged === 'on') {
            const { body, htmlBody } = getPostStatusData(data);
            if (body) {
                await chatApi.sendHtmlMessage(roomID, body, htmlBody);
            }
        }

        return true;
    } catch (err) {
        throw ['Error in postEpicUpdates', err].join('\n');
    }
};
