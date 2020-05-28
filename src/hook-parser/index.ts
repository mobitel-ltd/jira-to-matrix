import { Selectors } from '../types';
import { getLogger } from '../modules/log';
import * as messages from '../lib/messages';
import { redis, REDIS_IGNORE_PREFIX, REDIS_ROOM_KEY } from '../redis-client';

import { QueueHandler } from '../queue';
import { TaskTracker, Config } from '../types';
import { getRedisKey } from '../task-trackers/jira/selector.jira';
import { Parser } from '../task-trackers/jira/hook-parser';

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
    selectors: Selectors;
    parser: Parser;

    constructor(private taskTracker: TaskTracker, private config: Config, private queueHandler: QueueHandler) {
        this.testMode = this.config.testMode.on;
        this.ignoredUsers = [...this.config.usersToIgnore, ...this.config.testMode.users];
        this.selectors = taskTracker.selectors;
        this.parser = taskTracker.parser;
    }

    actionFuncs = {
        postIssueUpdates: this.parser.isPostIssueUpdates,
        inviteNewMembers: this.parser.isMemberInvite,
        postComment: this.parser.isPostComment,
        postEpicUpdates: this.parser.isPostEpicUpdates,
        postProjectUpdates: this.parser.isPostProjectUpdates,
        postNewLinks: this.parser.isPostNewLinks,
        postLinkedChanges: this.parser.isPostLinkedChanges,
        postLinksDeleted: this.parser.isDeleteLinks,
    };

    getBotActions = body => Object.keys(this.actionFuncs).filter(key => this.actionFuncs[key](body));

    getParserName = func => `get${func[0].toUpperCase()}${func.slice(1)}Data`;

    getFuncRedisData = body => funcName => {
        const parserName = this.getParserName(funcName);
        const data = this[parserName](body);
        const redisKey = getRedisKey(funcName, body);

        return { redisKey, funcName, data };
    };

    getFuncAndBody = body => {
        const botFunc = this.getBotActions(body);
        const createRoomData = this.parser.isCreateRoom(body) && this.parser.getCreateRoomData(body);
        const roomsData = { redisKey: REDIS_ROOM_KEY, createRoomData };
        const funcsData = botFunc.map(this.getFuncRedisData(body));

        return [roomsData, ...funcsData];
    };

    /**
     * Is ignore data
     */
    async getParsedAndSaveToRedis(body: any) {
        try {
            if (await this.isIgnore(body)) {
                return;
            }
            const parsedBody = this.getFuncAndBody(body);
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
        const sourceId = this.selectors.getIssueLinkSourceId(body);
        const issue = sourceId && (await this.taskTracker.getIssueSafety(sourceId));

        return issue ? sourceId : this.selectors.getIssueLinkDestinationId(body);
    }

    getHookHandler(type: IssueType) {
        const handlers = {
            issue: async body => {
                const key = this.selectors.getIssueKey(body)!;
                const status = await this.taskTracker.getIssueSafety(key);

                return !status || !!this.selectors.getChangelogField('Rank', body);
            },
            issuelink: async body => {
                const allId = [
                    this.selectors.getIssueLinkSourceId(body),
                    this.selectors.getIssueLinkDestinationId(body),
                ];
                const issues = await Promise.all(allId.map(this.taskTracker.getIssueSafety));

                return !issues.some(Boolean);
            },
            project: async body => {
                const key = this.selectors.getProjectKey(body)!;
                const { isIgnore } = await this.taskTracker.getProject(key);
                return isIgnore;
            },
            comment: async body => {
                const id = this.selectors.getIssueId(body)!;
                const status = await this.taskTracker.getIssueSafety(id);

                return !status;
            },
        };

        return handlers[type];
    }

    async isHookTypeIgnore(body) {
        const type = this.selectors.getHookType(body);
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
        const result = await redis.getAsync(REDIS_IGNORE_PREFIX);
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
            const nameTypeIssueLink = this.selectors.getNameIssueLinkType(body);
            return nameTypeIssueLink === 'jira_subtask_link';
        }

        return ignoreList.taskType.includes(taskType);
        // return ignoreList.taskType.includes(taskType) || ignoreList.issues.includes(issueKey);
    }

    async getManuallyIgnore(body) {
        const type = this.selectors.getHookType(body);
        if (type === 'project') {
            return false;
        }
        const { typeName } = this.selectors.getDescriptionFields(body);
        if (!typeName) {
            return false;
        }

        const keyOrId =
            type === 'issuelink'
                ? await this.getAvailableIssueId(body)
                : this.selectors.getIssueKey(body) || this.selectors.getIssueId(body);

        const issue = await this.taskTracker.getIssue(keyOrId!);
        const projectKey = this.selectors.getProjectKey({ issue });
        const issueCreator = this.selectors.getIssueCreator(issue) as string;

        return (await this.isManuallyIgnore(projectKey, typeName, type, body)) || this.isTestCreater(issueCreator);
    }

    async getIgnoreProject(body) {
        await this.taskTracker.testJiraRequest();
        const webhookEvent = this.selectors.getBodyWebhookEvent(body);
        const timestamp = this.selectors.getBodyTimestamp(body);
        const issueName = this.selectors.getIssueName(body);

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
