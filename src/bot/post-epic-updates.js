const Ramda = require('ramda');
const to = require('await-to-js').default;
const logger = require('debug')('bot post epic update');
const marked = require('marked');
const translate = require('../locales');
const redis = require('../redis-client');
const jira = require('../jira');
const {fp} = require('../utils');
const {epicUpdates: epicConf} = require('../config').features;
const {postStatusChanged} = require('./helper.js');

const epicRedisKey = epicID => `epic|${epicID}`;

const isInEpic = async (epicID, issueID) => {
    const [err, saved] = await to(
        redis.sismemberAsync(epicRedisKey(epicID), issueID)
    );
    if (err) {
        logger(`Error while querying redis:\n${err.message}`);
        return;
    }
    return saved;
};

const saveToEpic = async (epicID, issueID) => {
    const [err] = await to(
        redis.saddAsync(epicRedisKey(epicID), issueID)
    );
    if (err) {
        logger(`Redis error while adding issue to epic :\n${err.message}`);
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
    logger('postNewIssue');
    const saved = await isInEpic(epic.id, issue.id);
    if (saved) {
        logger('postNewIssue is saved');
        return;
    }
    const success = await sendMessageNewIssue(mclient, epic, issue);
    logger('postNewIssue success is', success);
    if (success) {
        logger(`Notified epic ${epic.key} room about issue ${issue.key} added to epic "${epic.fields.summary}"`);
        await saveToEpic(epic.id, issue.id);
    }
};

const postEpicUpdates = async ({mclient, data, epicKey}) => {
    logger('epicConf', epicConf);
    try {
        logger('postEpicUpdates start');
        if (!epicKey) {
            logger('no epicKey');
            return true;
        }
        const epic = await jira.issue.get(epicKey);
        if (!epic) {
            logger('no epic');
            return true;
        }
        logger('epic is ', epic);
        const roomID = await mclient.getRoomId(epicKey);
        if (!roomID) {
            logger('no roomID');
            return true;
        }
        logger('roomID is ', roomID);
        const epicPlus = Ramda.assoc('roomID', roomID, epic);

        if (epicConf.newIssuesInEpic === 'on') {
            await postNewIssue(epicPlus, data, mclient);
        }
        if (epicConf.issuesStatusChanged === 'on') {
            await postStatusChanged(roomID, data, mclient);
        }
        return true;
    } catch (err) {
        logger('error in postEpicUpdates', err);
        return false;
    }
};

module.exports = {
    postEpicUpdates,
};
