const Ramda = require('ramda');
const logger = require('../modules/log.js')(module);
const marked = require('marked');
const translate = require('../locales');
const redis = require('../redis-client');
const jira = require('../jira');
const {fp} = require('../utils');
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

const saveToEpic = async (epicID, issueID) => {
    try {
        await redis.saddAsync(epicRedisKey(epicID), issueID);
    } catch (err) {
        logger.error(`Redis error while adding issue to epic`);

        throw err;
    }
};

const sendMessageNewIssue = async (mclient, epic, newIssue) => {
    const values = fp.paths([
        'epic.fields.summary',
        'issue.key',
        'issue.summary',
    ], {epic, issue: newIssue});
    values['epic.ref'] = jira.issue.ref(epic.key);
    values['issue.ref'] = jira.issue.ref(newIssue.key);
    const success = await mclient.sendHtmlMessage(
        epic.roomID,
        translate('newIssueInEpic'),
        marked(translate('issueAddedToEpic', values))
    );
    return success;
};

const postNewIssue = async (epic, issue, mclient) => {
    try {
        logger.debug('postNewIssue');

        const saved = await isInEpic(epic.id, issue.id);
        if (saved) {
            logger.debug(`${issue} Already saved in Redis`);
            return;
        }
        const success = await sendMessageNewIssue(mclient, epic, issue);
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

module.exports = async ({mclient, data, epicKey}) => {
    try {
        logger.info('postEpicUpdates start');
        if (!epicKey) {
            logger.debug('no epicKey');
            return true;
        }
        const epic = await jira.issue.get(epicKey);
        if (!epic) {
            logger.debug('no epic');
            return true;
        }
        const roomID = await mclient.getRoomId(epicKey);
        if (!roomID) {
            logger.debug('no roomID');
            return true;
        }
        const epicPlus = Ramda.assoc('roomID', roomID, epic);

        if (epicConf.newIssuesInEpic === 'on') {
            await postNewIssue(epicPlus, data, mclient);
        }
        if (epicConf.issuesStatusChanged === 'on') {
            await postStatusChanged(roomID, data, mclient);
        }
        return true;
    } catch (err) {
        logger.error('error in postEpicUpdates');
        throw err;
    }
};
