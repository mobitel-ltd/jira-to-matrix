const htmlToText = require('html-to-text').fromString;
const Ramda = require('ramda');
const logger = require('../../modules/log.js')(module);
const translate = require('../../locales');
const marked = require('marked');
const {usersToIgnore, testMode} = require('../../config');
const utils = require('../../lib/utils.js');
const jiraRequests = require('../../lib/jira-request.js');

const getEpicInfo = epicLink =>
    ((epicLink === translate('miss'))
        ? ''
        : `            <br>Epic link:
                ${utils.getOpenedDescriptionBlock(epicLink)}
                ${utils.getClosedDescriptionBlock(utils.getViewUrl(epicLink))}`);

const getPost = body => {
    const post = `
            Assignee:
                ${utils.getOpenedDescriptionBlock(body.assigneeName)}
                ${utils.getClosedDescriptionBlock(body.assigneeEmail)}
            <br>Reporter:
                ${utils.getOpenedDescriptionBlock(body.reporterName)}
                ${utils.getClosedDescriptionBlock(body.reporterEmail)}
            <br>Type:
                ${utils.getClosedDescriptionBlock(body.typeName)}
            <br>Estimate time:
                ${utils.getClosedDescriptionBlock(body.estimateTime)}
            <br>Description:
                ${utils.getClosedDescriptionBlock(marked(body.description))}
            <br>Priority:
                ${utils.getClosedDescriptionBlock(body.priority)}`;

    const epicInfo = getEpicInfo(body.epicLink);

    return [post, epicInfo].join('\n');
};

const helper = {
    getDescription: async issue => {
        try {
            const {description} = await jiraRequests.getRenderedValues(issue.key, ['description']);
            const handleBody = description ? {...issue.descriptionFields, description} : issue.descriptionFields;
            const htmlBody = getPost(handleBody);
            const body = htmlToText(htmlBody);

            return {body, htmlBody};
        } catch (err) {
            throw utils.errorTracing('getDescription', err);
        }
    },

    getHookHandler: type => {
        const handlers = {
            issue: async body => {
                const key = utils.getIssueKey(body);
                const status = await jiraRequests.getIssueSafety(key);

                return !status || !!utils.getChangelogField('Rank', body);
            },
            issuelink: async body => {
                const allId = [utils.getIssueLinkSourceId(body), utils.getIssueLinkDestinationId(body)];
                const issues = await Promise.all(allId.map(jiraRequests.getIssueSafety));

                return !issues.some(Boolean);
            },
            project: async body => {
                const key = utils.getProjectKey(body);
                const projectBody = await jiraRequests.getProject(key);
                return utils.isIgnoreProject(projectBody);
            },
            comment: async body => {
                const id = utils.getIssueId(body);
                const status = await jiraRequests.getIssueSafety(id);

                return !status;
            },
        };

        return handlers[type];
    },

    getIgnoreStatus: body => {
        const type = utils.getHookType(body);
        const handler = helper.getHookHandler(type);
        if (!handler) {
            logger.warn('Unknown hook type, should be ignored!');
            return true;
        }

        return handler(body);
    },

    getIgnoreBodyData: body => {
        const username = utils.getHookUserName(body);
        const creator = utils.getCreatorDisplayName(body);

        const isInUsersToIgnore = arr =>
            [username, creator].some(user => arr.includes(user));

        if (!username && !creator) {
            return {username, creator, ignoreStatus: false};
        }

        const userIgnoreStatus = testMode.on ? !isInUsersToIgnore(testMode.users) : isInUsersToIgnore(usersToIgnore);

        return {username, creator, ignoreStatus: userIgnoreStatus};
    },

    getIgnoreProject: async body => {
        await jiraRequests.testJiraRequest();

        const ignoreStatus = await helper.getIgnoreStatus(body);
        const webhookEvent = utils.getBodyWebhookEvent(body);
        const timestamp = utils.getBodyTimestamp(body);
        const issueName = utils.getIssueName(body);

        return {timestamp, webhookEvent, ignoreStatus, issueName};
    },

    getEpicChangedMessageBody: ({summary, key, status, name}) => {
        const viewUrl = utils.getViewUrl(key);
        const values = {name, key, summary, status, viewUrl};

        const body = translate('statusEpicChanged');
        const message = translate('statusEpicChangedMessage', values, values.name);
        const htmlBody = marked(message);

        return {body, htmlBody};
    },

    getNewEpicMessageBody: ({key, summary}) => {
        const viewUrl = utils.getViewUrl(key);
        const values = {key, summary, viewUrl};

        const body = translate('newEpicInProject');
        const message = translate('epicAddedToProject', values, values.name);
        const htmlBody = marked(message);

        return {body, htmlBody};
    },
    getPostStatusData: data => {
        if (!data.status) {
            logger.warn('No status in getPostStatusData');

            return {};
        }

        const viewUrl = utils.getViewUrl(data.key);

        const body = translate('statusHasChanged', {...data, viewUrl});
        const message = translate('statusHasChangedMessage', {...data, viewUrl}, data.name);
        const htmlBody = marked(message);

        return {body, htmlBody};
    },

    getNewIssueMessageBody: ({summary, key}) => {
        const viewUrl = utils.getViewUrl(key);
        const values = {key, viewUrl, summary};

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
        const message = translate('issue_updated', {name: author});
        const changesDescription = fields.map(field =>
            `${field}: ${formattedValues[field]}`);

        return [message, ...changesDescription].join('<br>');
    },

    getIssueUpdateInfoMessageBody: async ({changelog, oldKey, author}) => {
        const fields = helper.fieldNames(changelog.items);
        const renderedValues = await jiraRequests.getRenderedValues(oldKey, fields);

        const changelogItemsTostring = helper.itemsToString(changelog.items);
        const formattedValues = {...changelogItemsTostring, ...renderedValues};

        const htmlBody = helper.composeText({author, fields, formattedValues});
        const body = translate('issueHasChanged');

        return {htmlBody, body};
    },

    getCommentHTMLBody: (headerText, commentBody) => `${headerText}: <br>${commentBody}`,

    getCommentBody: (issue, comment) => {
        const comments = Ramda.path(['renderedFields', 'comment', 'comments'], issue);

        const result = Ramda.propOr(
            comment.body,
            'body',
            Ramda.find(Ramda.propEq('id', comment.id), comments)
        );

        return result;
    },

    getPostLinkMessageBody: ({relation, related}, action = 'newLink') => {
        const key = utils.getKey(related);
        const viewUrl = utils.getViewUrl(key);
        const summary = utils.getSummary(related);
        const values = {key, relation, summary, viewUrl};

        const body = translate(action);
        const htmlBodyAction = related ? `${action}Message` : action;

        const message = translate(htmlBodyAction, values);
        const htmlBody = marked(message);

        return {body, htmlBody};
    },
};

module.exports = helper;
