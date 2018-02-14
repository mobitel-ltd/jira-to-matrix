const Ramda = require('ramda');
const translate = require('../locales');
const logger = require('../modules/log.js')(module);
const jira = require('../jira');
const {epicUpdates, postChangesToLinks} = require('../config').features;
const {composeRoomName, getNewStatus} = require('../bot/helper.js');

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
    const comment = {
        body: body.comment.body,
        id: body.comment.id,
    };

    const author = Ramda.path(['comment', 'author', 'name'], body);

    return {issueID, headerText, comment, author};
};

// Create room
const getTextIssue = (issue, address) => {
    const params = address.split('.');
    const text = String(
        Ramda.path(['fields', ...params], issue) || translate('miss')
    ).trim();

    return text;
};

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
    const descriptionFields = {
        assigneeName: getTextIssue(issue, 'assignee.displayName'),
        assigneeEmail: getTextIssue(issue, 'assignee.emailAddress'),
        reporterName: getTextIssue(issue, 'reporter.displayName'),
        reporterEmail: getTextIssue(issue, 'reporter.emailAddress'),
        typeName: getTextIssue(issue, 'issuetype.name'),
        epicLink: getTextIssue(issue, 'customfield_10006'),
        estimateTime: getTextIssue(issue, 'timetracking.originalEstimate'),
        description: getTextIssue(issue, 'description'),
        priority: getTextIssue(issue, 'priority.name'),
    };

    const url = Ramda.path(['fields', 'watches', 'self'], issue);
    const summary = Ramda.path(['fields', 'summary'], issue);
    const {key, id} = issue;
    const newIssue = {key, id, collectParticipantsBody, url, summary, descriptionFields};

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
    const allLinks = Ramda.path(['issue', 'fields', 'issuelinks'])(body);
    const links = allLinks.map(link => (link ? link.id : link));
    return {links};
};

// PostEpicUpdatesData

const getPostEpicUpdatesData = body => {
    const {issue} = body;
    const {key, id, changelog} = issue;
    const {field} = epicUpdates;
    const epicKey = Ramda.path(['fields', field], issue);

    const summary = Ramda.path(['fields', 'summary'], issue);
    const name = Ramda.path(['user', 'name'], body);
    const status = getNewStatus(body);

    const data = {key, summary, id, changelog, name, status};

    return {epicKey, data};
};

// Post link data
const getPostLinkedChangesData = body => {
    const {issue} = body;
    const {key, changelog, id} = issue;

    const links = Ramda.path(['issue', 'fields', 'issuelinks'])(body);
    const linksKeys = links.reduce((acc, link) => {
        const destIssue = Ramda.either(
            Ramda.prop('outwardIssue'),
            Ramda.prop('inwardIssue')
        )(link);
        if (!destIssue) {
            logger.debug('no destIssue in handleLink');
            return acc;
        }
        const destStatusCat = Ramda.path(['fields', 'status', 'statusCategory', 'id'], destIssue);
        if (postChangesToLinks.ignoreDestStatusCat.includes(destStatusCat)) {
            logger.debug('no includes destStatusCat');
            return acc;
        }
        return [...acc, destIssue.key];
    }, []);

    const status = getNewStatus(body);
    const summary = Ramda.path(['fields', 'summary'], issue);
    const name = Ramda.path(['user', 'name'], body);

    const data = {status, key, summary, id, changelog, name};

    return {linksKeys, data};
};

// PostProjectUpdates
const getPostProjectUpdatesData = body => {
    const typeEvent = body.issue_event_type_name;
    const {issue} = body;
    const projectOpts = issue.fields.project;
    const name = Ramda.path(['user', 'name'], body);
    const summary = Ramda.path(['fields', 'summary'], issue);
    const status = Ramda.path(['fields', 'status', 'name'], issue);
    const {key} = issue;
    const data = {key, summary, name, status};

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
