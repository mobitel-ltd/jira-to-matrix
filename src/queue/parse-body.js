const _ = require('lodash');
const Ramda = require('ramda');
const translate = require('../locales');
const logger = require('debug')('parse-body-jira');
const jira = require('../jira');
const {epicUpdates: epicConf} = require('../config').features;
const {getNewStatus} = require('../bot/helper.js');

// Post comment
const isCommentHook = Ramda.contains(Ramda.__, ['comment_created', 'comment_updated']);

const getheaderText = ({comment, webhookEvent}) => {
    const fullName = Ramda.path(['author', 'displayName'], comment);
    const event = isCommentHook(webhookEvent) ?
        webhookEvent :
        'comment_created';
    return `${fullName} ${translate(event, null, fullName)}`;
};

const getPostCommentData = body => {
    logger(`Enter in function create comment for hook {${body.webhookEvent}}`);

    const headerText = getheaderText(body);

    const issueID = jira.issue.extractID(JSON.stringify(body));
    logger('issueID', issueID);
    const comment = {
        body: body.comment.body,
        id: body.comment.id,
    };

    const author = _.get(body, 'comment.author.name');

    return {issueID, headerText, comment, author};
};


// Create room
const objHas = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

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
    logger(`issue: ${issue.key}`);

    let projectOpts;
    if (isEpic(body) || isProjectEvent(body)) {
        if (objHas(body, 'issue') && objHas(issue, 'fields')) {
            projectOpts = issue.fields.project;
        }

        if (objHas(body, 'project')) {
            projectOpts = body.project;
        }
    }
    const collectParticipantsBody = [
        _.get(issue, 'fields.creator.name'),
        _.get(issue, 'fields.reporter.name'),
        _.get(issue, 'fields.assignee.name'),
    ];

    const url = _.get(issue, 'fields.watches.self');
    const summary = Ramda.path(['fields', 'summary'], issue);
    const newIssue = {key: issue.key, collectParticipantsBody, url, summary};

    return {issue: newIssue, webhookEvent, projectOpts};
};

// InviteNewMembersData

const getInviteNewMembersData = body => {
    const {issue} = body;

    const collectParticipantsBody = [
        _.get(issue, 'fields.creator.name'),
        _.get(issue, 'fields.reporter.name'),
        _.get(issue, 'fields.assignee.name'),
    ];
    const url = _.get(issue, 'fields.watches.self');

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
    const projectOpts = body.issue.fields.project;
    const {issue} = body;
    const data = {
        key: issue.key,
        summary: issue.summary,
        name: body.user.name,
    };
    return {typeEvent, projectOpts, data};
};


module.exports = {
    getPostEpicUpdatesData,
    getPostCommentData,
    getCreateRoomData,
    getInviteNewMembersData,
    getPostNewLinksData,
    getPostLinkedChangesData,
    getPostProjectUpdatesData,
};
