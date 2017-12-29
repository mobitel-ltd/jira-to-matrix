const logger = require('../modules/log.js')(module);
const marked = require('marked');
const translate = require('../locales');
const redis = require('../redis-client');
const {issue: {ref, getIssue}} = require('../jira');
const {epicUpdates: epicConf} = require('../config').features;
const {postStatusChanged} = require('./helper.js');

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

const getNewIssueMessageBody = ({summary, key}) => {
    const issueRef = ref(key);
    const values = {key, issueRef, summary};

    const body = translate('newIssueInEpic');
    const message = translate('issueAddedToEpic', values);
    const htmlBody = marked(message);

    return {body, htmlBody};
};

const sendNewIssueMessage = async (mclient, roomID, {body, htmlBody}) => {
    try {
        const success = await mclient.sendHtmlMessage(roomID, body, htmlBody);
        return success;
    } catch (err) {
        logger.error('Error in sendNewIssueMessage');

        throw err;
    }
};

const saveToEpic = async (epicID, issueID) => {
    try {
        await redis.saddAsync(epicRedisKey(epicID), issueID);
    } catch (err) {
        logger.error(`Redis error while adding issue to epic`);

        throw err;
    }
};

const postNewIssue = async (roomID, {epic, issue}, mclient) => {
    try {
        logger.debug('postNewIssue');

        const saved = await isInEpic(epic.id, issue.id);
        if (saved) {
            logger.debug(`${issue} Already saved in Redis`);
            return;
        }
        const newIssueMessageBody = getNewIssueMessageBody(issue);
        const success = await sendNewIssueMessage(mclient, roomID, newIssueMessageBody);
        if (success) {
            logger.info(
                `Notified epic ${epic.key} room about issue ${issue.key} added to epic "${epic.fields.summary}"`
            );
            await saveToEpic(epic.id, issue.id);
        }
    } catch (err) {
        logger.error('Error in postNewIssue');

        throw err;
    }
};

const postEpicUpdates = async ({mclient, data, epicKey}) => {
    try {
        logger.info('postEpicUpdates start');
        if (!epicKey) {
            logger.debug('no epicKey');
            return true;
        }
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
        logger.error('error in postEpicUpdates');

        throw err;
    }
};

module.exports = {getNewIssueMessageBody, postEpicUpdates};
