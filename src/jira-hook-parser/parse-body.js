const Ramda = require('ramda');
const translate = require('../locales');
const {epicUpdates, postChangesToLinks} = require('../config').features;
const utils = require('../lib/utils.js');

// Post comment
const getHeaderText = body => {
    const fullName = utils.getFullName(body);
    const event = utils.getCommentEvent(body);

    return `${fullName} ${translate(event, null, fullName)}`;
};

const getPostCommentData = body => {
    const headerText = getHeaderText(body);

    const issueID = utils.extractID(body);
    const comment = {
        body: body.comment.body,
        id: body.comment.id,
    };

    const author = utils.getAuthor(body);

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
    const roomMembers = utils.getIssueMembers(body);
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

    const url = utils.getWatchersUrl(body);
    const summary = utils.getSummary(body);
    const key = utils.getKey(body);
    const id = utils.getId(body);
    const newIssue = {key, id, roomMembers, url, summary, descriptionFields};

    return {issue: newIssue, webhookEvent, projectOpts};
};

// InviteNewMembersData

const getInviteNewMembersData = body => {
    const roomMembers = utils.getIssueMembers(body);
    const url = utils.getWatchersUrl(body);
    const key = utils.getKey(body);

    return {issue: {key, roomMembers, url}};
};

// PostNewLinksData

const getPostNewLinksData = body => {
    const allLinks = utils.getLinks(body);
    const links = allLinks.map(link => (link ? link.id : link));

    return {links};
};

// PostEpicUpdatesData

const getPostEpicUpdatesData = body => {
    const {issue} = body;
    const {key, id, changelog} = issue;
    const {field} = epicUpdates;
    const epicKey = Ramda.path(['fields', field], issue);

    const summary = utils.getSummary(body);
    const name = utils.getUserName(body);
    const status = utils.getNewStatus(body);

    const data = {key, summary, id, changelog, name, status};

    return {epicKey, data};
};

// Post link data
const getPostLinkedChangesData = body => {
    const {issue} = body;
    const {key, changelog, id} = issue;

    const links = utils.getLinks(body);
    const linksKeys = links.reduce((acc, link) => {
        const destIssue = Ramda.either(
            Ramda.prop('outwardIssue'),
            Ramda.prop('inwardIssue')
        )(link);
        if (!destIssue) {
            return acc;
        }
        const destStatusCat = Ramda.path(['fields', 'status', 'statusCategory', 'id'], destIssue);
        if (postChangesToLinks.ignoreDestStatusCat.includes(destStatusCat)) {
            return acc;
        }
        return [...acc, destIssue.key];
    }, []);

    const status = utils.getNewStatus(body);
    const summary = utils.getSummary(body);
    const name = utils.getUserName(body);

    const data = {status, key, summary, id, changelog, name};

    return {linksKeys, data};
};

// PostProjectUpdates
const getPostProjectUpdatesData = body => {
    const typeEvent = body.issue_event_type_name;
    const projectOpts = utils.getProjectOpts(body);
    const name = utils.getUserName(body);
    const summary = utils.getSummary(body);
    const status = utils.getStatus(body);
    const key = utils.getKey(body);
    const data = {key, summary, name, status};

    return {typeEvent, projectOpts, data};
};

// PostIssueUpdates

const getPostIssueUpdatesData = body => {
    const {changelog, user, issue} = body;
    const fieldKey = utils.getChangelogField('Key', body);
    const key = utils.getKey(body);
    const issueKey = fieldKey ? fieldKey.fromString : key;
    const summary = utils.getSummary(body);
    const roomName = summary ? utils.composeRoomName({...issue, summary}) : null;

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
