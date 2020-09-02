import { getLogger } from '../modules/log';
import { TaskTracker, Config, ActionNames, CreateRoomData } from '../types';
import { redis, isIgnoreKey, ARCHIVE_PROJECT, REDIS_ROOM_KEY, HANDLED_KEY } from '../redis-client';
import { errorTracing, isNoRoomError, getKeyFromError } from '../lib/utils';
import { union } from 'ramda';
import { Actions } from '../bot/actions';

const logger = getLogger(module);

export class QueueHandler {
    constructor(private taskTracker: TaskTracker, private config: Config, private actions: Actions) {}

    async queueHandler() {
        try {
            const redisRooms = await this.getRedisRooms();
            await this.handleRedisRooms(redisRooms);

            const dataFromRedis = await this.getDataFromRedis();
            await this.handleRedisData(dataFromRedis);

            const commandKeys = await this.getCommandKeys();
            await this.handleCommandKeys(commandKeys);
        } catch (err) {
            logger.error('Error in queue handling', err);
        }
    }

    async getRedisKeys() {
        try {
            const allKeys = await redis.keysAsync(`${this.config.redis.prefix}*`);
            return allKeys.filter(isIgnoreKey);
        } catch (err) {
            throw ['getRedisKeys error', err].join('\n');
        }
    }

    async getCommandKeys() {
        try {
            const data = await redis.getList(ARCHIVE_PROJECT);
            if (!data || !data.length) {
                return [];
            }

            return data.map(value => {
                const [projectKey, ...options] = value.split('::');
                const parsedOptions = options
                    .map(el => {
                        const [name, param] = el.split('=');

                        return { [name]: param };
                    })
                    .reduce((acc, val) => ({ ...acc, ...val }), {});

                return { operationName: ARCHIVE_PROJECT, projectKey, ...parsedOptions, value };
            });
        } catch (error) {
            logger.error(errorTracing('Error in getting command keys values', error));
            return false;
        }
    }

    getRedisValue = async (key: string) => {
        try {
            const newKey = key.replace(this.config.redis.prefix, '');

            const redisValue = await redis.getAsync(newKey);
            const parsedRedisValue = JSON.parse(redisValue);
            // logger.info(`Value from redis by key ${key}: `, parsedRedisValue);
            const result = redisValue ? { redisKey: newKey, ...parsedRedisValue } : false;

            return result;
        } catch (err) {
            logger.error(errorTracing(`Error in getting value of key: ${key}`, err));

            return false;
        }
    };

    async getDataFromRedis() {
        try {
            const allKeys = await this.getRedisKeys();
            const values = await Promise.all(allKeys.map(this.getRedisValue));
            const filteredValues = values.filter(Boolean);

            return filteredValues.length > 0 ? filteredValues : null;
        } catch (err) {
            logger.error('getDataFromRedis error');

            return null;
        }
    }

    /**
     * @returns {Promise<object[]>} createRoomData
     */
    async getRedisRooms(): Promise<CreateRoomData[] | null> {
        try {
            const roomsKeyValue = await redis.getAsync(REDIS_ROOM_KEY);
            const createRoomData = JSON.parse(roomsKeyValue);

            return createRoomData;
        } catch (err) {
            logger.error('getRedisRooms error');

            return null;
        }
    }

    /**
     */
    async getHandledKeys(): Promise<string[] | undefined> {
        try {
            const keys = await redis.getAsync(HANDLED_KEY);
            const handledKeys = JSON.parse(keys);

            return handledKeys || [];
        } catch (err) {
            logger.error('getRedisRooms error');
        }
    }

    async isHandled(key) {
        const handledKeys = (await this.getHandledKeys()) || [];

        return handledKeys.includes(key);
    }

    async saveToHandled(newKeys) {
        const oldKeys = (await this.getHandledKeys()) || [];
        await redis.setAsync(HANDLED_KEY, JSON.stringify([...oldKeys, ...newKeys]));
    }

    createRoomDataOnlyNew(createRoomData) {
        const createRoomDataByKey = createRoomData
            .map(el => {
                const { issue, projectKey } = el;
                const keyMap = issue ? issue.key : projectKey;

                return { [keyMap]: el };
            })
            .reduce((acc, el) => ({ ...acc, ...el }), {});

        return Object.values(createRoomDataByKey);
    }

    /**
     * @param {Array} createRoomData array redis room data
     * @returns {Promise<void>} no data
     */
    async rewriteRooms(createRoomData: Array<any>): Promise<void> {
        const dataForCreateRoom = this.createRoomDataOnlyNew(createRoomData);
        const bodyToJSON = JSON.stringify(dataForCreateRoom);
        await redis.setAsync(REDIS_ROOM_KEY, bodyToJSON);
        logger.info('Rooms data rewrited by redis.');
    }

    getLog(key: string, success: string) {
        return `${key} --- ${success}`;
    }

    async handleRedisData(dataFromRedis) {
        try {
            if (!dataFromRedis) {
                logger.warn('No data from redis');

                return;
            }
            const result = await Promise.all(
                dataFromRedis.map(
                    async ({ redisKey, funcName, data }: { redisKey: string; funcName: ActionNames; data: any }) => {
                        try {
                            await this.actions.run(funcName, data);
                            await redis.delAsync(redisKey);

                            return { redisKey, success: true };
                        } catch (err) {
                            const errBody = typeof err === 'string' ? err : err.stack;
                            logger.error(`Error in ${redisKey}\n`, err);

                            if (isNoRoomError(errBody)) {
                                const key = getKeyFromError(errBody);
                                if (this.taskTracker.selectors.isIssueRoomName(key)) {
                                    if (await this.taskTracker.getIssueSafety(key)) {
                                        logger.warn(`Room with key ${key} is not found, trying to create it again`);
                                        const newRoomRecord = { issue: { key } };

                                        return { redisKey, newRoomRecord, success: false };
                                    }

                                    logger.debug(`Issue for key ${key} is not found, delete key from redis`);
                                    await redis.delAsync(redisKey);

                                    return { redisKey, success: true };
                                }

                                logger.warn(`Room for key ${key} is not found, keep ${redisKey}`);
                            }

                            return { redisKey, success: false };
                        }
                    },
                ),
            );

            const newRoomRecords = result.map(({ newRoomRecord }) => newRoomRecord).filter(Boolean);
            const logs = result.map(({ redisKey, success }) => this.getLog(redisKey, success));

            if (newRoomRecords.length) {
                logger.info('This room should be created', JSON.stringify(newRoomRecords));
                const redisRoomsData = (await this.getRedisRooms()) || [];
                await this.rewriteRooms([...redisRoomsData, ...newRoomRecords]);
            }

            logger.info('Result of handling redis key', JSON.stringify(logs));
        } catch (err) {
            logger.error('handleRedisData error', err);
        }
    }

    async handleRedisRooms(roomsData) {
        const roomHandle = async (data: CreateRoomData) => {
            try {
                await this.actions.run(ActionNames.CreateRoom, data);

                return null;
            } catch (err) {
                logger.error('Error in handle room data\n', err);

                return data;
            }
        };
        try {
            if (!roomsData) {
                logger.debug('No rooms from redis');

                return;
            }
            const handledRooms = await Promise.all(roomsData.map(roomHandle));
            const filteredRooms = handledRooms.filter(Boolean);
            if (filteredRooms.length > 0) {
                logger.warn('Rooms which not created', JSON.stringify(filteredRooms));

                await this.rewriteRooms(filteredRooms);
            } else {
                logger.info('All rooms handled');
                await redis.delAsync(REDIS_ROOM_KEY);
            }
        } catch (err) {
            logger.error('handleRedisRooms error', err);
        }
    }

    async saveIncoming({ redisKey, ...restData }) {
        try {
            let redisValue = restData;
            if (redisKey === REDIS_ROOM_KEY) {
                const { createRoomData } = restData;
                if (!createRoomData) {
                    logger.warn('No createRoomData!');
                    return;
                }

                const dataToAddToRedis = Array.isArray(createRoomData) ? createRoomData : [createRoomData];
                // logger.debug('New data for redis rooms:', dataToAddToRedis);

                const currentRedisRoomData = (await this.getRedisRooms()) || [];
                redisValue = union(currentRedisRoomData, dataToAddToRedis);
            }

            const bodyToJSON = JSON.stringify(redisValue);
            if (redisKey !== REDIS_ROOM_KEY) {
                const handleStatus = await this.isHandled(redisKey);
                if (handleStatus) {
                    logger.info('This key has already been handled: ', redisKey);

                    return;
                }
                await redis.setAsync(redisKey, bodyToJSON);
                logger.info('data saved by redis. RedisKey: ', redisKey);

                return redisKey;
            }

            await redis.setAsync(redisKey, bodyToJSON);
            logger.info('data saved by redis. RedisKey: ', redisKey);
        } catch (err) {
            throw ['Error while saving to redis:', err].join('\n');
        }
    }

    async handleCommandKeys(keys): Promise<Record<string, any> | undefined> {
        try {
            const result = {};
            for await (const key of keys) {
                const { operationName, projectKey, value, ...options } = key;
                const res = await this.actions.run(operationName, { projectKey, ...options });
                await redis.srem(operationName, value);

                logger.info(`Result of handling project ${value}: ${JSON.stringify(res)}`);

                result[projectKey] = res;
            }

            return result;
        } catch (error) {
            logger.error(error);
        }
    }
}
