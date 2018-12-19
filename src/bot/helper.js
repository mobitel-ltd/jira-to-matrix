const Ramda = require('ramda');
const logger = require('../modules/log.js')(module);
const translate = require('../locales');
const marked = require('marked');
const {usersToIgnore, testMode, matrix} = require('../config');
const utils = require('../lib/utils.js');
const jiraRequests = require('../lib/jira-request.js');

const helper = {
    isStartEndUpdateStatus: body => {
        const isStart = utils.getChangelogField('Start date', body);
        const isEnd = utils.getChangelogField('End date', body);

        return !!isStart || !!isEnd;
    },

    getLink: async id => {
        logger.debug(id);
        const link = await jiraRequests.getLinkedIssue(id);

        return utils.getInwardLinkKey(link);
    },

    isPrivateIssue: async body => {
        try {
            const issueId = utils.isLinkHook(utils.getBodyWebhookEvent(body))
                ? await helper.getLink(utils.getIssueLinkId(body))
                : utils.extractID(body);
            logger.debug(issueId);

            const issue = await jiraRequests.getIssue(issueId);
            return !issue;
        } catch (err) {
            return true;
        }
    },

    getProjectPrivateStatus: async body => {
        const projectId = utils.getBodyProjectId(body);

        if (projectId) {
            const projectBody = await jiraRequests.getProject(projectId);

            return Ramda.path(['isPrivate'], projectBody);
        }
        await jiraRequests.testJiraRequest();

        return helper.isPrivateIssue(body);
    },


    getIgnoreBodyData: body => {
        const username = utils.webHookUser(body);
        const creator = utils.getCreator(body);

        const isInUsersToIgnore = arr =>
            [username, creator].some(user => arr.includes(user));

        const userIgnoreStatus = testMode.on ? !isInUsersToIgnore(testMode.users) : isInUsersToIgnore(usersToIgnore);
        logger.debug('userIgnoreStatus', userIgnoreStatus);
        const startEndUpdateStatus = helper.isStartEndUpdateStatus(body);
        const ignoreStatus = userIgnoreStatus || startEndUpdateStatus;

        return {username, creator, startEndUpdateStatus, ignoreStatus};
    },

    getIgnoreProject: async body => {
        const ignoreStatus = await helper.getProjectPrivateStatus(body);
        const webhookEvent = utils.getBodyWebhookEvent(body);
        const timestamp = utils.getBodyTimestamp(body);
        const issueName = utils.getBodyIssueName(body);

        return {timestamp, webhookEvent, ignoreStatus, issueName};
    },

    getIgnoreInfo: async body => {
        const userStatus = helper.getIgnoreBodyData(body);
        const projectStatus = await helper.getIgnoreProject(body);

        return {userStatus, projectStatus};
    },

    membersInvited: roomMembers =>
        Ramda.pipe(
            Ramda.values,
            Ramda.map(Ramda.prop('userId'))
        )(roomMembers),

    getUserID: shortName => `@${shortName}:${matrix.domain}`,

    getEpicChangedMessageBody: ({summary, key, status, name}) => {
        const issueRef = utils.getViewUrl(key);
        const values = {name, key, summary, status, issueRef};

        const body = translate('statusEpicChanged');
        const message = translate('statusEpicChangedMessage', values, values.name);
        const htmlBody = marked(message);

        return {body, htmlBody};
    },

    getNewEpicMessageBody: ({key, summary}) => {
        const issueRef = utils.getViewUrl(key);
        const values = {key, summary, issueRef};

        const body = translate('newEpicInProject');
        const message = translate('epicAddedToProject', values, values.name);
        const htmlBody = marked(message);

        return {body, htmlBody};
    },

    postStatusData: data => {
        const {status} = data;
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
    },

    postStatusChanged: async ({mclient, roomID, data}) => {
        try {
            const {body, htmlBody} = helper.postStatusData(data);
            if (!body) {
                logger.warn('No body for sending to Matrix');
                return;
            }

            await mclient.sendHtmlMessage(roomID, body, htmlBody);
        } catch (err) {
            throw ['Error in postStatusChanged', err].join('\n');
        }
    },

    getNewIssueMessageBody: ({summary, key}) => {
        const issueRef = utils.getViewUrl(key);
        const values = {key, issueRef, summary};

        const body = translate('newIssueInEpic');
        const message = translate('issueAddedToEpic', values);
        const htmlBody = marked(message);

        return {body, htmlBody};
    },

    fieldNames: items =>
        items.reduce((acc, {field}) =>
            (field ? [...acc, field] : acc), []),

    itemsToString: items =>
        items.reduce((acc, {field, toString}) =>
            (field ? {...acc, [field]: toString} : acc), {}),

    composeText: ({author, fields, formattedValues}) => {
        const message = translate('issue_updated', null, author);
        const messageHeader = `${author} ${message}`;
        const changesDescription = fields.map(field =>
            `${field}: ${formattedValues[field]}`);

        return [messageHeader, ...changesDescription].join('<br>');
    },

    getIssueUpdateInfoMessageBody: async ({changelog, key, user}) => {
        try {
            const author = user.displayName;
            const fields = helper.fieldNames(changelog.items);
            const renderedValues = await jiraRequests.getRenderedValues(key, fields);

            const changelogItemsTostring = helper.itemsToString(changelog.items);
            const formattedValues = {...changelogItemsTostring, ...renderedValues};

            const htmlBody = helper.composeText({author, fields, formattedValues});
            const body = translate('issueHasChanged');

            return {htmlBody, body};
        } catch (err) {
            throw ['Error in getIssueUpdateInfoMessageBody', err].join('\n');
        }
    },

    getCommentHTMLBody: (headerText, commentBody) => `${headerText}: <br>${commentBody}`,

    getCommentBody: (issue, comment) => {
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
    },

    getPostLinkMessageBody: ({relation, related}) => {
        const {key} = related;
        const issueRef = utils.getViewUrl(key);
        const summary = Ramda.path(['fields', 'summary'], related);
        const values = {key, relation, summary, issueRef};

        const body = translate('newLink');
        const message = translate('newLinkMessage', values);
        const htmlBody = marked(message);

        return {body, htmlBody};
    },
};


module.exports = helper;
