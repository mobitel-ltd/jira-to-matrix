import { getLogger } from '../modules/log';
import * as messages from '../lib/messages';
import * as utils from '../lib/utils';
import { redis } from '../redis-client';
import { getParser } from './parsers';

import { QueueHandler } from '../queue';
import { TaskTracker, Config } from '../types';

const logger = getLogger(module);

enum IssueType {
    issue = 'issue',
    comment = 'comment',
    project = 'project',
    issuelink = 'issuelink',
}

export class HookParser {
    testMode: boolean;
    ignoredUsers: string[];

    constructor(private taskTracker: TaskTracker, private config: Config, private queueHandler: QueueHandler) {
        this.testMode = this.config.testMode.on;
        this.ignoredUsers = [...this.config.usersToIgnore, ...this.config.testMode.users];
    }

    /**
     * Is ignore data
     */
    async getParsedAndSaveToRedis(body: any) {
        try {
            if (await this.isIgnore(body)) {
                return;
            }
            const parser = getParser('jira');

            const parsedBody = parser(body);
            const handledKeys = (await Promise.all(parsedBody.map(el => this.queueHandler.saveIncoming(el)))).filter(
                Boolean,
            );

            await this.queueHandler.saveToHandled(handledKeys);

            return true;
        } catch (err) {
            logger.error('Error in parsing ', err);

            return false;
        }
    }

    isTestCreater(creator: string): boolean {
        const ignoreStatus = this.testMode ? !this.ignoredUsers.includes(creator) : this.ignoredUsers.includes(creator);

        return ignoreStatus;
    }

    async getAvailableIssueId(body) {
        const sourceId = utils.getIssueLinkSourceId(body);
        const issue = sourceId && (await this.taskTracker.getIssueSafety(sourceId));

        return issue ? sourceId : utils.getIssueLinkDestinationId(body);
    }

    getHookHandler(type: IssueType) {
        const handlers = {
            issue: async body => {
                const key = utils.getIssueKey(body);
                const status = await this.taskTracker.getIssueSafety(key);

                return !status || !!utils.getChangelogField('Rank', body);
            },
            issuelink: async body => {
                const allId = [utils.getIssueLinkSourceId(body), utils.getIssueLinkDestinationId(body)];
                const issues = await Promise.all(allId.map(this.taskTracker.getIssueSafety));

                return !issues.some(Boolean);
            },
            project: async body => {
                const key = utils.getProjectKey(body);
                const { isIgnore } = await this.taskTracker.getProject(key);
                return isIgnore;
            },
            comment: async body => {
                const id = utils.getIssueId(body);
                const status = await this.taskTracker.getIssueSafety(id);

                return !status;
            },
        };

        return handlers[type];
    }

    async isHookTypeIgnore(body) {
        const type = utils.getHookType(body);
        const handler = this.getHookHandler(type as IssueType);
        if (!handler) {
            logger.warn('Unknown hook type, should be ignored!');
            return true;
        }
        const status = await handler(body);

        if (status) {
            logger.warn('Project should be ignore');
        }

        return status;
    }

    async isManuallyIgnore(project, taskType, type, body) {
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
    }

    async getManuallyIgnore(body) {
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
                ? await this.getAvailableIssueId(body)
                : utils.getIssueKey(body) || utils.getIssueId(body);

        const issue = await this.taskTracker.getIssue(keyOrId);
        const projectKey = utils.getProjectKey({ issue });
        const issueCreator = utils.getIssueCreator(issue) as string;

        return (await this.isManuallyIgnore(projectKey, typeName, type, body)) || this.isTestCreater(issueCreator);
    }

    async getIgnoreProject(body) {
        await this.taskTracker.testJiraRequest();
        const webhookEvent = utils.getBodyWebhookEvent(body);
        const timestamp = utils.getBodyTimestamp(body);
        const issueName = utils.getIssueName(body);

        const ignoreStatus = (await this.isHookTypeIgnore(body)) || (await this.getManuallyIgnore(body));

        return { timestamp, webhookEvent, ignoreStatus, issueName };
    }

    async isIgnore(body: any) {
        const projectStatus = await this.getIgnoreProject(body);
        const msg = messages.getWebhookStatusLog({ projectStatus });

        logger.info(msg);

        // return userStatus.ignoreStatus || projectStatus.ignoreStatus;
        return projectStatus.ignoreStatus;
    }
}
