const logger = require('../modules/log.js')(module);
const redis = require('../redis-client');
const {getIssue} = require('../lib/jira-request.js');
const {epicUpdates: epicConf} = require('../config').features;
const {postStatusChanged, getNewIssueMessageBody} = require('./helper.js');

const epicRedisKey = epicID => `epic|${epicID}`;

const isInEpic = async (epicID, issueID) => {
    try {
        const redisKey = epicRedisKey(epicID);
        const saved = await redis.sismemberAsync(redisKey, issueID);
        return saved;
    } catch (err) {
        throw ['Error while querying redis', err].join('\n');
    }
};

const saveToEpic = async (epicID, issueID) => {
    try {
        const status = await redis.saddAsync(epicRedisKey(epicID), issueID);
        logger.debug(`${epicRedisKey(epicID)} of ${issueID} have status ${status}`);
    } catch (err) {
        throw ['Redis error while adding issue to epic', err].join('\n');
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
        throw ['Error in postNewIssue', err].join('\n');
    }
};

module.exports = async ({mclient, data, epicKey}) => {
    try {
        const epic = await getIssue(epicKey);
        const roomID = await mclient.getRoomId(epicKey);
        if (!roomID) {
            logger.warn(`No room for ${epicKey} in PostEpicUpdates`);
            return;
        }
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
