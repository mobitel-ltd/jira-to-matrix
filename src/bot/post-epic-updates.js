const Ramda = require('ramda');
const to = require('await-to-js').default;
const logger = require('debug')('bot post epic update');
const marked = require('marked');
const translate = require('../locales');
const redis = require('../redis-client');
const jira = require('../jira');
const {fp} = require('../utils');
const {epicUpdates: epicConf} = require('../config').features;

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
        'issue.fields.summary',
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
    const saved = await isInEpic(epic.id, issue.id);
    if (saved) {
        return;
    }
    const success = await sendMessageNewIssue(mclient, epic, issue);
    if (success) {
        logger(`Notified epic ${epic.key} room about issue ${issue.key} added to epic "${epic.fields.summary}"`);
        await saveToEpic(epic.id, issue.id);
    }
};

const getNewStatus = Ramda.pipe(
    Ramda.pathOr([], ['changelog', 'items']),
    Ramda.filter(Ramda.propEq('field', 'status')),
    Ramda.head,
    Ramda.propOr(null, 'toString')
);

const postStatusChanged = async (roomID, hook, mclient) => {
    const status = getNewStatus(hook);
    if (typeof status !== 'string') {
        return;
    }
    const values = fp.paths([
        'user.name',
        'issue.key',
        'issue.fields.summary',
    ], hook);
    values['issue.ref'] = jira.issue.ref(hook.issue.key);
    values.status = status;
    await mclient.sendHtmlMessage(
        roomID,
        translate('statusHasChanged', values),
        marked(translate('statusHasChangedMessage', values, values['user.name']))
    );
};

const postEpicUpdates = async ({mclient, body: hook}) => {
    const {issue} = hook;
    const epicKey = Ramda.path(['fields', epicConf.field], issue);
    if (!epicKey) {
        return;
    }
    const epic = await jira.issue.get(epicKey);
    if (!epic) {
        return;
    }
    const roomID = await mclient.getRoomId(epicKey);
    if (!roomID) {
        return;
    }
    const epicPlus = Ramda.assoc('roomID', roomID, epic);

    if (epicConf.newIssuesInEpic === 'on') {
        await postNewIssue(epicPlus, issue, mclient);
    }
    if (epicConf.issuesStatusChanged === 'on') {
        await postStatusChanged(roomID, hook, mclient);
    }
};

const shouldPostChanges = ({body, mclient}) => Boolean(
    typeof body === 'object'
    && (
        body.webhookEvent === 'jira:issue_updated'
        || (body.webhookEvent === 'jira:issue_created' && typeof body.changelog === 'object')
    )
    && typeof body.issue === 'object'
    && mclient
);

const middleware = async req => {
    if (shouldPostChanges(req)) {
        await postEpicUpdates(req);
    }
};

module.exports = {
    middleware,
    postStatusChanged,
    getNewStatus,
};
