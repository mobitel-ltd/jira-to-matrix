import * as messages from '../lib/messages';
import { getLogger } from '../modules/log';
import * as utils from '../lib/utils';
import { redis } from '../redis-client';

const logger = getLogger(module);

export const isTestCreater = (creator: string, usersToIgnore: string[], testMode: boolean): boolean => {
    const ignoreStatus = testMode ? !usersToIgnore.includes(creator) : usersToIgnore.includes(creator);

    return ignoreStatus;
};

export const getAvailableIssueId = async (body, taskTracker) => {
    const sourceId = utils.getIssueLinkSourceId(body);

    return (await taskTracker.getIssueSafety(sourceId)) ? sourceId : utils.getIssueLinkDestinationId(body);
};

export const getHookHandler = (type, taskTracker) => {
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

export const isHookTypeIgnore = async (body, taskTracker) => {
    const type = utils.getHookType(body);
    const handler = getHookHandler(type, taskTracker);
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

export const getManuallyIgnore = async (body, usersToIgnore, testMode, taskTracker) => {
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
            ? await getAvailableIssueId(body, taskTracker)
            : utils.getIssueKey(body) || utils.getIssueId(body);

    const issue = await taskTracker.getIssue(keyOrId);
    const projectKey = utils.getProjectKey({ issue });
    const issueCreator = utils.getIssueCreator(issue) as string;

    return (
        (await isManuallyIgnore(projectKey, typeName, type, body)) ||
        isTestCreater(issueCreator, usersToIgnore, testMode)
    );
};

export const getIgnoreProject = async (body, usersToIgnore, testMode, taskTracker) => {
    await taskTracker.testJiraRequest();
    const webhookEvent = utils.getBodyWebhookEvent(body);
    const timestamp = utils.getBodyTimestamp(body);
    const issueName = utils.getIssueName(body);

    const ignoreStatus =
        (await isHookTypeIgnore(body, taskTracker)) ||
        (await getManuallyIgnore(body, usersToIgnore, testMode, taskTracker));

    return { timestamp, webhookEvent, ignoreStatus, issueName };
};

export const isIgnore = async (body, usersToIgnore, testMode, taskTracker) => {
    const projectStatus = await getIgnoreProject(body, usersToIgnore, testMode, taskTracker);
    const msg = messages.getWebhookStatusLog({ projectStatus });

    logger.info(msg);

    // return userStatus.ignoreStatus || projectStatus.ignoreStatus;
    return projectStatus.ignoreStatus;
};
