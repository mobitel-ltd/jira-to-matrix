const Ramda = require('ramda');
const logger = require('../modules/log.js')(module);
const translate = require('../locales');
const marked = require('marked');
const {usersToIgnore, testMode, matrix} = require('../config');
const utils = require('../lib/utils.js');
const jiraRequests = require('../lib/jira-request.js');

const isStartEndUpdateStatus = body => {
    const isStart = utils.getChangelogField('Start date', body);
    const isEnd = utils.getChangelogField('End date', body);
    return !!isStart || !!isEnd;
};

const isPrivateIssue = async body => {
    const issueId = utils.extractID(body);
    try {
        const issue = await jiraRequests.getIssue(issueId);

        return !issue;
    } catch (err) {
        return true;
    }
};

const getProjectPrivateStatus = async body => {
    const projectId = utils.getBodyProjectId(body);

    if (projectId) {
        const projectBody = await jiraRequests.getProject(projectId);

        return Ramda.path(['isPrivate'], projectBody);
    }
    await jiraRequests.testJiraRequest();

    return isPrivateIssue(body);
};


const getIgnoreBodyData = body => {
    const username = utils.webHookUser(body);
    const creator = utils.getCreator(body);

    const isInUsersToIgnore = arr =>
        [username, creator].some(user => arr.includes(user));

    const userIgnoreStatus = testMode.on ? !isInUsersToIgnore(testMode.users) : isInUsersToIgnore(usersToIgnore);
    const startEndUpdateStatus = isStartEndUpdateStatus(body);
    const ignoreStatus = userIgnoreStatus || startEndUpdateStatus;

    return {username, creator, startEndUpdateStatus, ignoreStatus};
};

const getIgnoreProject = async body => {
    const ignoreStatus = await getProjectPrivateStatus(body);
    const webhookEvent = utils.getBodyWebhookEvent(body);
    const timestamp = utils.getBodyTimestamp(body);
    const issueName = utils.getBodyIssueName(body);

    return {timestamp, webhookEvent, ignoreStatus, issueName};
};

const getIgnoreInfo = async body => {
    const userStatus = getIgnoreBodyData(body);
    const projectStatus = await getIgnoreProject(body);

    return {userStatus, projectStatus};
};

const membersInvited = roomMembers =>
    Ramda.pipe(
        Ramda.values,
        Ramda.map(Ramda.prop('userId'))
    )(roomMembers);

const getUserID = shortName => `@${shortName}:${matrix.domain}`;

const getEpicChangedMessageBody = ({summary, key, status, name}) => {
    const issueRef = utils.getViewUrl(key);
    const values = {name, key, summary, status, issueRef};

    const body = translate('statusEpicChanged');
    const message = translate('statusEpicChangedMessage', values, values.name);
    const htmlBody = marked(message);

    return {body, htmlBody};
};

const getNewEpicMessageBody = ({key, summary}) => {
    const issueRef = utils.getViewUrl(key);
    const values = {key, summary, issueRef};

    const body = translate('newEpicInProject');
    const message = translate('epicAddedToProject', values, values.name);
    const htmlBody = marked(message);

    return {body, htmlBody};
};

const postStatusData = data => {
    const {status} = data;
    logger.debug('status is ', status);
    if (typeof status !== 'string') {
        logger.warn('No status in postStatusData');

        return {};
    }

    const issueRef = utils.getViewUrl(data.key);
    const baseValues = {status, issueRef};
    const values = ['name', 'key', 'summary']
        .reduce((acc, key) => ({...acc, [key]: data[key]}), baseValues);

    const body = translate('statusHasChanged', values);
    const message = translate('statusHasChangedMessage', values, values.name);
    const htmlBody = marked(message);

    return {body, htmlBody};
};

const postStatusChanged = async ({mclient, roomID, data}) => {
    try {
        const {body, htmlBody} = postStatusData(data);
        if (!body) {
            logger.warn('No body for sending to Matrix');
            return;
        }

        await mclient.sendHtmlMessage(roomID, body, htmlBody);
    } catch (err) {
        throw ['Error in postStatusChanged', err].join('\n');
    }
};

const getNewIssueMessageBody = ({summary, key}) => {
    const issueRef = utils.getViewUrl(key);
    const values = {key, issueRef, summary};

    const body = translate('newIssueInEpic');
    const message = translate('issueAddedToEpic', values);
    const htmlBody = marked(message);

    return {body, htmlBody};
};

const fieldNames = items =>
    items.reduce((acc, {field}) =>
        (field ? [...acc, field] : acc), []);

const itemsToString = items =>
    items.reduce((acc, {field, toString}) =>
        (field ? {...acc, [field]: toString} : acc), {});

const composeText = ({author, fields, formattedValues}) => {
    const message = translate('issue_updated', null, author);
    const messageHeader = `${author} ${message}`;
    const changesDescription = fields.map(field =>
        `${field}: ${formattedValues[field]}`);

    return [messageHeader, ...changesDescription].join('<br>');
};

const getIssueUpdateInfoMessageBody = async ({changelog, key, user}) => {
    try {
        const author = user.displayName;
        const fields = fieldNames(changelog.items);
        const renderedValues = await jiraRequests.getRenderedValues(key, fields);

        const changelogItemsTostring = itemsToString(changelog.items);
        const formattedValues = {...changelogItemsTostring, ...renderedValues};

        const htmlBody = composeText({author, fields, formattedValues});
        const body = translate('issueHasChanged');

        return {htmlBody, body};
    } catch (err) {
        throw ['Error in getIssueUpdateInfoMessageBody', err].join('\n');
    }
};

const getCommentHTMLBody = (headerText, commentBody) => `${headerText}: <br>${commentBody}`;

const getCommentBody = (issue, comment) => {
    const comments = Ramda.path(['renderedFields', 'comment', 'comments'], issue);
    if (!(comments instanceof Array)) {
        return comment.body;
    }

    const result = Ramda.propOr(
        comment.body,
        'body',
        Ramda.find(Ramda.propEq('id', comment.id), comments)
    );

    return result;
};

module.exports = {
    getCommentBody,
    getCommentHTMLBody,
    membersInvited,
    getUserID,
    postStatusData,
    postStatusChanged,
    getEpicChangedMessageBody,
    getNewEpicMessageBody,
    getNewIssueMessageBody,
    getIssueUpdateInfoMessageBody,
    itemsToString,
    composeText,
    fieldNames,
    getIgnoreBodyData,
    isStartEndUpdateStatus,
    getIgnoreInfo,
    getIgnoreProject,
};
