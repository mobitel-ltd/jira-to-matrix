const logger = require('../modules/log.js')(module);
const redis = require('../redis-client');
const {getIssue} = require('../jira').issue;
const {epicUpdates: epicConf} = require('../config').features;
const {postStatusChanged, getNewIssueMessageBody} = require('./helper.js');

const epicRedisKey = epicID => `epic|${epicID}`;

const isInEpic = async (epicID, issueID) => {
    try {
        const redisKey = epicRedisKey(epicID);
        const saved = await redis.sismemberAsync(redisKey, issueID);
        return saved;
    } catch (err) {
        logger.error(`Error while querying redis`);

        throw err;
    }
};

const saveToEpic = async (epicID, issueID) => {
    try {
        const status = await redis.saddAsync(epicRedisKey(epicID), issueID);
        logger.debug(`${epicRedisKey(epicID)} of ${issueID} have status ${status}`);
    } catch (err) {
        logger.error(`Redis error while adding issue to epic`);

        throw err;
    }
};

const postNewIssue = async (roomID, {epic, issue}, mclient) => {
    try {
        const saved = await isInEpic(epic.id, issue.id);
        if (saved) {
            logger.debug(`${issue.id} Already saved in Redis by ${epic.id}`);

            return;
        }

        const {body, htmlBody} = getNewIssueMessageBody(issue);
        await mclient.sendHtmlMessage(roomID, body, htmlBody);

        logger.info(`Notified epic ${epic.key} room about issue ${issue.key} added to epic "${epic.fields.summary}"`);
        await saveToEpic(epic.id, issue.id);
    } catch (err) {
        logger.error('Error in postNewIssue');

        throw err;
    }
};

module.exports = async ({mclient, data, epicKey}) => {
    logger.info('postEpicUpdates start');
    try {
        const epic = await getIssue(epicKey);
        const roomID = await mclient.getRoomId(epicKey);

        if (epicConf.newIssuesInEpic === 'on') {
            await postNewIssue(roomID, {epic, issue: data}, mclient);
        }
        if (epicConf.issuesStatusChanged === 'on') {
            await postStatusChanged({roomID, data, mclient});
        }

        return true;
    } catch (err) {
        logger.error('Error in postEpicUpdates');

        throw err;
    }
};
