import * as R from 'ramda';
import * as marked from 'marked';
import * as utils from '../../lib/utils';
import { getLogger } from '../../modules/log';
import { translate } from '../../locales';

const logger = getLogger(module);

export const getHookHandler = type => {
    const handlers = {
        issue: async body => {
            const key = utils.getIssueKey(body);
            const status = await taskTracker.getIssueSafety(key);

            return !status || !!utils.getChangelogField('Rank', body);
        },
        issuelink: async body => {
            const allId = [utils.getIssueLinkSourceId(body), utils.getIssueLinkDestinationId(body)];
            const issues = await Promise.all(allId.map(taskTracker.getIssueSafety));

            return !issues.some(Boolean);
        },
        project: async body => {
            const key = utils.getProjectKey(body);
            const { isIgnore } = await taskTracker.getProject(key);
            return isIgnore;
        },
        comment: async body => {
            const id = utils.getIssueId(body);
            const status = await taskTracker.getIssueSafety(id);

            return !status;
        },
    };

    return handlers[type];
};

export const isHookTypeIgnore = async body => {
    const type = utils.getHookType(body);
    const handler = getHookHandler(type);
    if (!handler) {
        logger.warn('Unknown hook type, should be ignored!');
        return true;
    }
    const status = await handler(body);

    if (status) {
        logger.warn('Project should be ignore');
    }

    return status;
};

export const getAvailableIssueId = async body => {
    const sourceId = utils.getIssueLinkSourceId(body);

    return (await taskTracker.getIssueSafety(sourceId)) ? sourceId : utils.getIssueLinkDestinationId(body);
};

export const isManuallyIgnore = async (project, taskType, type, body) => {
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
};

/**
 * @param {string} creator creator
 * @param  {string[]} usersToIgnore users to ignore
 * @param {boolean} testMode test mode
 * @returns {boolean} status
 */
export const isTestCreater = (creator, usersToIgnore, testMode) => {
    const ignoreStatus = testMode ? !usersToIgnore.includes(creator) : usersToIgnore.includes(creator);

    return ignoreStatus;
};

export const getManuallyIgnore = async (body, usersToIgnore, testMode) => {
    const type = utils.getHookType(body);
    if (type === 'project') {
        return false;
    }
    const { typeName } = utils.getDescriptionFields(body);
    if (!typeName) {
        return false;
    }

    const keyOrId =
        type === 'issuelink' ? await getAvailableIssueId(body) : utils.getIssueKey(body) || utils.getIssueId(body);

    const issue = await taskTracker.getIssue(keyOrId);
    const projectKey = utils.getProjectKey({ issue });
    const issueCreator = utils.getIssueCreator(issue);

    return (
        (await isManuallyIgnore(projectKey, typeName, type, body)) ||
        isTestCreater(issueCreator, usersToIgnore, testMode)
    );
};

export const getIgnoreProject = async (body, usersToIgnore, testMode) => {
    await taskTracker.testJiraRequest();
    const webhookEvent = utils.getBodyWebhookEvent(body);
    const timestamp = utils.getBodyTimestamp(body);
    const issueName = utils.getIssueName(body);

    const ignoreStatus = (await isHookTypeIgnore(body)) || (await getManuallyIgnore(body, usersToIgnore, testMode));

    return { timestamp, webhookEvent, ignoreStatus, issueName };
};

export const getEpicChangedMessageBody = ({ summary, key, status, name }) => {
    const viewUrl = utils.getViewUrl(key);
    const values = { name, key, summary, status, viewUrl };

    const body = translate('statusEpicChanged');
    const message = translate('statusEpicChangedMessage', values, values.name);
    const htmlBody = marked(message);

    return { body, htmlBody };
};

export const getNewEpicMessageBody = ({ key, summary }) => {
    const viewUrl = utils.getViewUrl(key);
    const values = { key, summary, viewUrl };

    const body = translate('newEpicInProject');
    const message = translate('epicAddedToProject', values, values.name);
    const htmlBody = marked(message);

    return { body, htmlBody };
};
export const getPostStatusData = (data): { body: string; htmlBody: string } | undefined => {
    if (!data.status) {
        logger.warn('No status in getPostStatusData');

        return;
    }

    const viewUrl = utils.getViewUrl(data.key);

    const body = translate('statusHasChanged', { ...data, viewUrl });
    const message = translate('statusHasChangedMessage', { ...data, viewUrl }, data.name);
    const htmlBody = marked(message);

    return { body, htmlBody };
};

export const getNewIssueMessageBody = ({ summary, key }) => {
    const viewUrl = utils.getViewUrl(key);
    const values = { key, viewUrl, summary };

    const body = translate('newIssueInEpic');
    const message = translate('issueAddedToEpic', values);
    const htmlBody = marked(message);

    return { body, htmlBody };
};

export const fieldNames = items => items.reduce((acc, { field }) => (field ? [...acc, field] : acc), []);

export const itemsToString = items =>
    items.reduce((acc, { field, toString }) => (field ? { ...acc, [field]: toString } : acc), {});

export const composeText = ({ author, fields, formattedValues }) => {
    const message = translate('issue_updated', { name: author });
    const changesDescription = fields.map(field => `${field}: ${formattedValues[field]}`);

    return [message, ...changesDescription].join('<br>');
};

export const getIssueUpdateInfoMessageBody = async ({ changelog, oldKey, author }) => {
    const fields = fieldNames(changelog.items);
    const renderedValues = await taskTracker.getRenderedValues(oldKey, fields);

    const changelogItemsTostring = itemsToString(changelog.items);
    const formattedValues = { ...changelogItemsTostring, ...renderedValues };

    const htmlBody = composeText({ author, fields, formattedValues });
    const body = translate('issueHasChanged');

    return { htmlBody, body };
};

export const getCommentHTMLBody = (headerText, commentBody) => `${headerText}: <br>${commentBody}`;

export const getCommentBody = (issue, comment) => {
    const comments = R.path(['renderedFields', 'comment', 'comments'], issue);

    const result = R.propOr(comment.body, 'body', R.find(R.propEq('id', comment.id), comments));

    return result;
};

export const getPostLinkMessageBody = ({ relation, related }, action = 'newLink') => {
    const key = utils.getKey(related);
    const viewUrl = utils.getViewUrl(key);
    const summary = utils.getSummary(related);
    const values = { key, relation, summary, viewUrl };

    const body = translate(action);
    const htmlBodyAction = related ? `${action}Message` : action;

    const message = translate(htmlBodyAction, values);
    const htmlBody = marked(message);

    return { body, htmlBody };
};

export const isAvatarIssueKey = (issueKey, usingPojects) => {
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
};

// usingPojects: 'all' | [string] | undefined
export const getNewAvatarUrl = async (issueKey, { statusId, colors, usingPojects }) => {
    if (!colors) {
        logger.warn(`No color links is passed to update avatar for room ${issueKey}`);

        return;
    }
    if (!statusId) {
        logger.warn(`No statusId is passed to update avatar for room ${issueKey}`);

        return;
    }

    if (isAvatarIssueKey(issueKey, usingPojects)) {
        const { colorName } = await taskTracker.getStatusData(statusId);

        return colors[colorName];
    }
};

export const getDefaultAvatarLink = (key, type, colorsConfigData) => {
    if (!colorsConfigData) {
        return;
    }

    if (isAvatarIssueKey(key, colorsConfigData.projects)) {
        return colorsConfigData.links[type];
    }
};
