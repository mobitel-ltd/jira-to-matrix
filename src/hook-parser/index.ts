import { Selectors, Parser } from '../types';
import { getLogger } from '../modules/log';
import * as messages from '../lib/messages';
import { redis, REDIS_IGNORE_PREFIX, REDIS_ROOM_KEY } from '../redis-client';

import { QueueHandler } from '../queue';
import { TaskTracker, Config } from '../types';

const logger = getLogger(module);

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

    getParserName(func) {
        return `get${func[0].toUpperCase()}${func.slice(1)}Data`;
    }

    getFuncRedisData = (funcName, body) => {
        const parserName = this.getParserName(funcName);
        const data = this.parser[parserName](body);
        const redisKey = this.selectors.getRedisKey(funcName, body);

        return { redisKey, funcName, data };
    };

    getFuncAndBody = body => {
        const botFunc = this.parser.getBotActions(body);
        const createRoomData = this.parser.isCreateRoom(body) && this.parser.getCreateRoomData(body);
        const roomsData = { redisKey: REDIS_ROOM_KEY, createRoomData };
        const funcsData = botFunc.map(funcName => this.getFuncRedisData(funcName, body));

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

    isTestCreator(creator: string): boolean {
        const status = this.testMode ? !this.ignoredUsers.includes(creator) : this.ignoredUsers.includes(creator);
        if (status) {
            logger.warn(
                `Hook should be ignored because issue creator is ${creator} in test mode state: ${this.testMode}`,
            );
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

        return this.taskTracker.checkIgnoreList(ignoreList.taskType, taskType, type, body);
    }

    async getManuallyIgnore(body) {
        const type = this.selectors.getHookType(body);
        if (this.taskTracker.isAvoidHookType(type)) {
            return false;
        }
        const descriptionFields = this.selectors.getDescriptionFields(body);

        const keyOrId = await this.taskTracker.getKeyOrIdForCheckIgnore(body);
        const issue = await this.taskTracker.getIssue(keyOrId!);
        const projectKey = this.selectors.getProjectKey(issue);

        const status = await this.isManuallyIgnore(projectKey, descriptionFields?.typeName, type, body);
        if (status) {
            logger.warn('Hook is ignored by user manually');
        }

        return status;
    }

    async isIgnoreCreator(body) {
        const keyOrId = await this.taskTracker.getKeyOrIdForCheckIgnore(body);

        const issue = await this.taskTracker.getIssue(keyOrId!);
        const issueCreator = this.selectors.getIssueCreator(issue) as string;

        return this.isTestCreator(issueCreator);
    }

    async isIgnoreHook(body): Promise<boolean> {
        const status = await this.taskTracker.isIgnoreHook(body);
        if (status) {
            logger.warn('Hook should be ignored because its type is cannot be handle');
        }

        return status;
    }

    async getIgnoreProject(body) {
        await this.taskTracker.testJiraRequest();
        const webhookEvent = this.selectors.getBodyWebhookEvent(body);
        const timestamp = this.selectors.getBodyTimestamp(body);
        const issueName = this.selectors.getIssueName(body);

        const ignoreStatus =
            (await this.isIgnoreHook(body)) ||
            (await this.getManuallyIgnore(body)) ||
            (await this.isIgnoreCreator(body));

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
