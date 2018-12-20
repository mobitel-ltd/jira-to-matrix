const logger = require('../modules/log.js')(module);
const redis = require('../redis-client');
const {getIssue} = require('../lib/jira-request.js');
const {epicUpdates: epicConf} = require('../config').features;
const {postStatusChanged, getNewIssueMessageBody} = require('./helper.js');
const utils = require('../lib/utils');

const postNewIssue = async (roomID, {epic, issue}, mclient) => {
    try {
        const redisEpicKey = utils.getRedisEpicKey(epic.id);
        if (await redis.isInEpic(redisEpicKey, issue.id)) {
            logger.debug(`Issue ${issue.key} already saved in Redis by epic ${epic.key}`);

            return;
        }

        const {body, htmlBody} = getNewIssueMessageBody(issue);
        await redis.saveToEpic(redisEpicKey, issue.id);
        logger.info(`Info about issue ${issue.key} added to epic ${epic.key}`);

        await mclient.sendHtmlMessage(roomID, body, htmlBody);
    } catch (err) {
        throw ['Error in postNewIssue', err].join('\n');
    }
};

module.exports = async ({mclient, data, epicKey}) => {
    try {
        const roomID = await mclient.getRoomId(epicKey);
        const epic = await getIssue(epicKey);

        if (epicConf.newIssuesInEpic === 'on') {
            await postNewIssue(roomID, {epic, issue: data}, mclient);
        }
        if (epicConf.issuesStatusChanged === 'on') {
            await postStatusChanged({roomID, data, mclient});
        }

        return true;
    } catch (err) {
        throw ['Error in postEpicUpdates', err].join('\n');
    }
};
