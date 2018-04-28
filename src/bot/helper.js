const Ramda = require('ramda');
const logger = require('../modules/log.js')(module);
const translate = require('../locales');
const marked = require('marked');
const {usersToIgnore, testMode, matrix} = require('../config');
const {webHookUser, getCreator, getChangelogField} = require('../lib/utils.js');
const {getProjectUrl, getRenderedValues} = require('../lib/jira-request.js');

const isStartEndUpdateStatus = body => {
    const isStart = getChangelogField('Start date', body);
    const isEnd = getChangelogField('End date', body);
    return !!isStart || !!isEnd;
};

const isIgnore = body => {
    const username = webHookUser(body);
    const creator = getCreator(body);

    // eslint-disable-next-line
    const isInUsersToIgnore = arr => {
        // eslint-disable-next-line
        return [username, creator].reduce((acc, item) => {
            return acc || arr.includes(item);
        }, false);
    };

    const userIgnoreStatus = testMode.on ? !isInUsersToIgnore(testMode.users) : isInUsersToIgnore(usersToIgnore);
    const startEndUpdateStatus = isStartEndUpdateStatus(body);
    const ignoreStatus = userIgnoreStatus || startEndUpdateStatus;
    return {username, creator, startEndUpdateStatus, ignoreStatus};
};

const membersInvited = roomMembers =>
    Ramda.pipe(
        Ramda.values,
        Ramda.map(Ramda.prop('userId'))
    )(roomMembers);

const getUserID = shortName => `@${shortName}:${matrix.domain}`;

const getEpicChangedMessageBody = ({summary, key, status, name}) => {
    const issueRef = getProjectUrl(key);
    const values = {name, key, summary, status, issueRef};

    const body = translate('statusEpicChanged');
    const message = translate('statusEpicChangedMessage', values, values.name);
    const htmlBody = marked(message);

    return {body, htmlBody};
};

const getNewEpicMessageBody = ({key, summary}) => {
    const issueRef = getProjectUrl(key);
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

    const issueRef = getProjectUrl(data.key);
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
    const issueRef = getProjectUrl(key);
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
        const renderedValues = await getRenderedValues(key, fields);

        const changelogItemsTostring = itemsToString(changelog.items);
        const formattedValues = {...changelogItemsTostring, ...renderedValues};

        const htmlBody = composeText({author, fields, formattedValues});
        const body = translate('issueHasChanged');

        return {htmlBody, body};
    } catch (err) {
        throw ['Error in getIssueUpdateInfoMessageBody', err].join('\n');
    }
};


module.exports = {
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
    isIgnore,
    isStartEndUpdateStatus,
};
