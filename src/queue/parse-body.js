const Ramda = require('ramda');
const translate = require('../locales');
const logger = require('../modules/log.js')(module);
const jira = require('../jira');
const {epicUpdates: epicConf} = require('../config').features;
const {getNewStatus} = require('../bot/helper.js');
const {composeRoomName} = require('../matrix/helpers.js');

// Post comment
const isCommentHook = Ramda.contains(Ramda.__, ['comment_created', 'comment_updated']);

const getHeaderText = ({comment, webhookEvent}) => {
    const fullName = Ramda.path(['author', 'displayName'], comment);
    const event = isCommentHook(webhookEvent) ?
        webhookEvent :
        'comment_created';
    return `${fullName} ${translate(event, null, fullName)}`;
};

const getPostCommentData = body => {
    logger.debug(`Enter in function create comment for hook {${body.webhookEvent}}`);

    const headerText = getHeaderText(body);

    const issueID = jira.issue.extractID(JSON.stringify(body));
    logger.debug('issueID', issueID);
    const comment = {
        body: body.comment.body,
        id: body.comment.id,
    };

    const author = Ramda.path(['comment', 'author', 'name'], body);

    return {issueID, headerText, comment, author};
};

// Create room
const isEpic = body => Boolean(
    typeof body === 'object'
    && typeof body.issue === 'object'
    && typeof body.issue.fields === 'object'
    && body.issue.fields.issuetype.name === 'Epic'
);

const isProjectEvent = body => Boolean(
    typeof body === 'object'
    && (
        body.webhookEvent === 'project_created'
        || body.webhookEvent === 'project_updated'
    )
);

const getCreateRoomData = body => {
    const {issue, webhookEvent} = body;
    logger.debug(`issue: ${issue.key}`);

    let projectOpts;
    if (isEpic(body) || isProjectEvent(body)) {
        if (Object.keys(issue).includes('fields')) {
            projectOpts = issue.fields.project;
        }

        if (Object.keys(body).includes('project')) {
            projectOpts = body.project;
        }
    }
    const collectParticipantsBody = [
        Ramda.path(['fields', 'creator', 'name'], issue),
        Ramda.path(['fields', 'reporter', 'name'], issue),
        Ramda.path(['fields', 'assignee', 'name'], issue),
    ];

    const url = Ramda.path(['fields', 'watches', 'self'], issue);
    const summary = Ramda.path(['fields', 'summary'], issue);
    const newIssue = {key: issue.key, collectParticipantsBody, url, summary};

    return {issue: newIssue, webhookEvent, projectOpts};
};

// InviteNewMembersData

const getInviteNewMembersData = body => {
    const {issue} = body;

    const collectParticipantsBody = [
        Ramda.path(['fields', 'creator', 'name'], issue),
        Ramda.path(['fields', 'reporter', 'name'], issue),
        Ramda.path(['fields', 'assignee', 'name'], issue),
    ];
    const url = Ramda.path(['fields', 'watches', 'self'], issue);

    const newIssue = {key: issue.key, collectParticipantsBody, url};

    return {issue: newIssue};
};

// PostNewLinksData

const getPostNewLinksData = body => {
    const links = Ramda.path(['issue', 'fields', 'issuelinks'])(body);

    return {links};
};

// PostEpicUpdatesData

const getPostEpicUpdatesData = body => {
    const {issue} = body;
    const epicKey = Ramda.path(['fields', epicConf.field], issue);

    const summary = Ramda.path(['fields', 'summary'], issue);
    const name = Ramda.path(['user', 'name'], body);

    const data = {
        key: issue.key,
        summary,
        id: issue.id,
        changelog: issue.changelog,
        name,
    };

    return {epicKey, data};
};

// Post link data
const getPostLinkedChangesData = body => {
    const {issue} = body;
    const links = Ramda.path(['issue', 'fields', 'issuelinks'])(body);
    const status = getNewStatus(body);
    const summary = Ramda.path(['fields', 'summary'], issue);
    const name = Ramda.path(['user', 'name'], body);

    const data = {
        key: issue.key,
        summary,
        id: issue.id,
        changelog: issue.changelog,
        name,
    };

    return {links, data, status};
};

// PostProjectUpdates
const getPostProjectUpdatesData = body => {
    const typeEvent = body.issue_event_type_name;
    const {issue} = body;
    const projectOpts = issue.fields.project;
    const name = Ramda.path(['user', 'name'], body);
    const {summary, key} = issue;
    const data = {key, summary, name};

    return {typeEvent, projectOpts, data};
};

// PostIssueUpdates

const getPostIssueUpdatesData = body => {
    const {changelog, user, issue} = body;
    const fieldKey = jira.getChangelogField('Key', body);
    const {key} = issue;
    const issueKey = fieldKey ? fieldKey.fromString : key;
    const summary = Ramda.path(['fields', 'summary'], issue);
    const roomName = summary ? composeRoomName({...issue, summary}) : null;

    return {issueKey, fieldKey, summary, roomName, changelog, user, key};
};


module.exports = {
    getPostEpicUpdatesData,
    getPostCommentData,
    getCreateRoomData,
    getInviteNewMembersData,
    getPostNewLinksData,
    getPostLinkedChangesData,
    getPostProjectUpdatesData,
    getPostIssueUpdatesData,
};
