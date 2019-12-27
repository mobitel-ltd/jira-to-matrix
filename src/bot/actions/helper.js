const htmlToText = require('html-to-text').fromString;
const Ramda = require('ramda');
const logger = require('../../modules/log.js')(module);
const translate = require('../../locales');
const marked = require('marked');
// const { usersToIgnore, testMode } = require('../../config');
const utils = require('../../lib/utils.js');
const jiraRequests = require('../../lib/jira-request.js');
const redis = require('../../redis-client');

// eslint-disable-next-line
const getEpicInfo = epicLink =>
    epicLink === translate('miss')
        ? ''
        : `            <br>Epic link:
                ${utils.getOpenedDescriptionBlock(epicLink)}
                ${utils.getClosedDescriptionBlock(utils.getViewUrl(epicLink))}`;

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
            const { description } = await jiraRequests.getRenderedValues(issue.key, ['description']);
            const handleBody = description ? { ...issue.descriptionFields, description } : issue.descriptionFields;
            const htmlBody = getPost(handleBody);
            const body = htmlToText(htmlBody);

            return { body, htmlBody };
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
                const { isIgnore } = await jiraRequests.getProject(key);
                return isIgnore;
            },
            comment: async body => {
                const id = utils.getIssueId(body);
                const status = await jiraRequests.getIssueSafety(id);

                return !status;
            },
        };

        return handlers[type];
    },

    isHookTypeIgnore: async body => {
        const type = utils.getHookType(body);
        const handler = helper.getHookHandler(type);
        if (!handler) {
            logger.warn('Unknown hook type, should be ignored!');
            return true;
        }
        const status = await handler(body);

        if (status) {
            logger.warn('Project should be ignore');
        }

        return status;
    },

    getAvailableIssueId: async body => {
        const sourceId = utils.getIssueLinkSourceId(body);

        return (await jiraRequests.getIssueSafety(sourceId)) ? sourceId : utils.getIssueLinkDestinationId(body);
    },

    isManuallyIgnore: async (project, taskType, type, body) => {
        // example {INDEV: {taskType: ['task', 'error'], BBQ: ['task']}}
        const result = await redis.getAsync(utils.REDIS_IGNORE_PREFIX);
        const redisIgnore = JSON.parse(result);
        if (!redisIgnore) {
            logger.debug('No redis ignore projects found!!!');
            return false;
        }
        const ignoreList = redisIgnore[project];
        if (!ignoreList) {
            return false;
        }
        if (type === 'issuelink' && ignoreList.taskType.includes('Sub-task')) {
            const nameTypeIssueLink = utils.getNameIssueLinkType(body);
            return nameTypeIssueLink === 'jira_subtask_link';
        }

        return ignoreList.taskType.includes(taskType);
        // return ignoreList.taskType.includes(taskType) || ignoreList.issues.includes(issueKey);
    },

    /**
     * @param {string} creator creator
     * @param  {string[]} usersToIgnore users to ignore
     * @param {boolean} testMode test mode
     * @return {boolean} status
     */
    isTestCreater: (creator, usersToIgnore, testMode) => {
        const ignoreStatus = testMode ? !usersToIgnore.includes(creator) : usersToIgnore.includes(creator);

        return ignoreStatus;
    },

    getManuallyIgnore: async (body, usersToIgnore, testMode) => {
        const type = utils.getHookType(body);
        if (type === 'project') {
            return false;
        }
        const { typeName } = utils.getDescriptionFields(body);
        if (!typeName) {
            return false;
        }

        const keyOrId =
            type === 'issuelink'
                ? await helper.getAvailableIssueId(body)
                : utils.getIssueKey(body) || utils.getIssueId(body);

        const issue = await jiraRequests.getIssue(keyOrId);
        const projectKey = utils.getProjectKey({ issue });
        const issueCreator = utils.handleIssueAsHook.getCreator({ issue });

        return (
            (await helper.isManuallyIgnore(projectKey, typeName, type, body)) ||
            helper.isTestCreater(issueCreator, usersToIgnore, testMode)
        );
    },

    getIgnoreProject: async (body, usersToIgnore, testMode) => {
        await jiraRequests.testJiraRequest();
        const webhookEvent = utils.getBodyWebhookEvent(body);
        const timestamp = utils.getBodyTimestamp(body);
        const issueName = utils.getIssueName(body);

        const ignoreStatus =
            (await helper.isHookTypeIgnore(body)) || (await helper.getManuallyIgnore(body, usersToIgnore, testMode));

        return { timestamp, webhookEvent, ignoreStatus, issueName };
    },

    getEpicChangedMessageBody: ({ summary, key, status, name }) => {
        const viewUrl = utils.getViewUrl(key);
        const values = { name, key, summary, status, viewUrl };

        const body = translate('statusEpicChanged');
        const message = translate('statusEpicChangedMessage', values, values.name);
        const htmlBody = marked(message);

        return { body, htmlBody };
    },

    getNewEpicMessageBody: ({ key, summary }) => {
        const viewUrl = utils.getViewUrl(key);
        const values = { key, summary, viewUrl };

        const body = translate('newEpicInProject');
        const message = translate('epicAddedToProject', values, values.name);
        const htmlBody = marked(message);

        return { body, htmlBody };
    },
    getPostStatusData: data => {
        if (!data.status) {
            logger.warn('No status in getPostStatusData');

            return {};
        }

        const viewUrl = utils.getViewUrl(data.key);

        const body = translate('statusHasChanged', { ...data, viewUrl });
        const message = translate('statusHasChangedMessage', { ...data, viewUrl }, data.name);
        const htmlBody = marked(message);

        return { body, htmlBody };
    },

    getNewIssueMessageBody: ({ summary, key }, type = 'Epic') => {
        const viewUrl = utils.getViewUrl(key);
        const values = { key, viewUrl, summary };

        const body = translate(`newIssueIn${type}`);
        const message = translate(`issueAddedTo${type}`, values);
        const htmlBody = marked(message);

        return { body, htmlBody };
    },

    fieldNames: items => items.reduce((acc, { field }) => (field ? [...acc, field] : acc), []),

    itemsToString: items =>
        items.reduce((acc, { field, toString }) => (field ? { ...acc, [field]: toString } : acc), {}),

    composeText: ({ author, fields, formattedValues }) => {
        const message = translate('issue_updated', { name: author });
        const changesDescription = fields.map(field => `${field}: ${formattedValues[field]}`);

        return [message, ...changesDescription].join('<br>');
    },

    getIssueUpdateInfoMessageBody: async ({ changelog, oldKey, author }) => {
        const fields = helper.fieldNames(changelog.items);
        const renderedValues = await jiraRequests.getRenderedValues(oldKey, fields);

        const changelogItemsTostring = helper.itemsToString(changelog.items);
        const formattedValues = { ...changelogItemsTostring, ...renderedValues };

        const htmlBody = helper.composeText({ author, fields, formattedValues });
        const body = translate('issueHasChanged');

        return { htmlBody, body };
    },

    getCommentHTMLBody: (headerText, commentBody) => `${headerText}: <br>${commentBody}`,

    getCommentBody: (issue, comment) => {
        const comments = Ramda.path(['renderedFields', 'comment', 'comments'], issue);

        const result = Ramda.propOr(comment.body, 'body', Ramda.find(Ramda.propEq('id', comment.id), comments));

        return result;
    },

    getPostLinkMessageBody: ({ relation, related }, action = 'newLink') => {
        const key = utils.getKey(related);
        const viewUrl = utils.getViewUrl(key);
        const summary = utils.getSummary(related);
        const values = { key, relation, summary, viewUrl };

        const body = translate(action);
        const htmlBodyAction = related ? `${action}Message` : action;

        const message = translate(htmlBodyAction, values);
        const htmlBody = marked(message);

        return { body, htmlBody };
    },

    isAvatarIssueKey: (issueKey, usingPojects) => {
        if (!usingPojects) {
            logger.warn(`No usingPojects is passed to update avatar for room ${issueKey}`);

            return false;
        }

        if (usingPojects === 'all') {
            return true;
        }

        const [projectKey] = issueKey.split('-');
        if (usingPojects.includes(projectKey)) {
            return true;
        }
        logger.warn(`Project with key ${projectKey} is not exist in config. Avatar will not be updated.`);

        return false;
    },

    // usingPojects: 'all' | [string] | undefined
    getNewAvatarUrl: async (issueKey, { statusId, colors, usingPojects }) => {
        if (!colors) {
            logger.warn(`No color links is passed to update avatar for room ${issueKey}`);

            return;
        }
        if (!statusId) {
            logger.warn(`No statusId is passed to update avatar for room ${issueKey}`);

            return;
        }

        if (helper.isAvatarIssueKey(issueKey, usingPojects)) {
            const { colorName } = await jiraRequests.getStatusData(statusId);

            return colors[colorName];
        }
    },

    getDefaultAvatarLink: (key, type, colorsConfigData) => {
        if (!colorsConfigData) {
            return;
        }

        if (helper.isAvatarIssueKey(key, colorsConfigData.projects)) {
            return colorsConfigData.links[type];
        }
    },
};

module.exports = helper;
