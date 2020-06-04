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
        const ignoreStatus = this.testMode ? !this.ignoredUsers.includes(creator) : this.ignoredUsers.includes(creator);

        return ignoreStatus;
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
        if (this.taskTracker.isIgnoreHookType(type)) {
            return false;
        }
        const { typeName } = this.selectors.getDescriptionFields(body);
        if (!typeName) {
            return false;
        }

        const keyOrId = await this.taskTracker.getKeyOrIdForCheckIgnore(body);
        const issue = await this.taskTracker.getIssue(keyOrId!);
        const projectKey = this.selectors.getProjectKey({ issue });

        return await this.isManuallyIgnore(projectKey, typeName, type, body);
    }

    async isIgnoreCreator(body) {
        const keyOrId = await this.taskTracker.getKeyOrIdForCheckIgnore(body);

        const issue = await this.taskTracker.getIssue(keyOrId!);
        const issueCreator = this.selectors.getIssueCreator(issue) as string;

        return this.isTestCreator(issueCreator);
    }

    async getIgnoreProject(body) {
        await this.taskTracker.testJiraRequest();
        const webhookEvent = this.selectors.getBodyWebhookEvent(body);
        const timestamp = this.selectors.getBodyTimestamp(body);
        const issueName = this.selectors.getIssueName(body);

        const ignoreStatus =
            (await this.taskTracker.isIgnoreHook(body)) ||
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
