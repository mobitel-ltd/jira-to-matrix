const _ = require('lodash');
const Ramda = require('ramda');
const translate = require('../locales');
const logger = require('debug')('parse-body-jira');
const jira = require('../jira');
const {epicUpdates: epicConf} = require('../config').features;

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

const getPostNewLinksData = body => {
    const links = Ramda.path(['issue', 'fields', 'issuelinks'])(body);

    return {links};
};

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


module.exports = {
    getPostEpicUpdatesData,
    getPostCommentData,
    getCreateRoomData,
    getInviteNewMembersData,
    getPostNewLinksData,
};
