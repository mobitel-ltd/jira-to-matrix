import Ramda from 'ramda';
import { redis } from '../redis-client';
import * as bot from '../bot/actions';
import * as utils from '../lib/utils';
import { config } from '../config';
import { getLogger } from '../modules/log';
import { MessengerFasade, Config, TaskTracker } from '../types';

const prefix = config.redis;
const logger = getLogger(module);

const getRedisKeys = async () => {
    try {
        const allKeys = await redis.keysAsync(`${prefix}*`);
        return allKeys.filter(utils.isIgnoreKey);
    } catch (err) {
        throw ['getRedisKeys error', err].join('\n');
    }
};

export const getCommandKeys = async () => {
    try {
        const data = await redis.getList(utils.ARCHIVE_PROJECT);
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

            return { operationName: utils.ARCHIVE_PROJECT, projectKey, ...parsedOptions, value };
        });
    } catch (error) {
        logger.error(utils.errorTracing('Error in getting command keys values', error));
        return false;
    }
};

export const getRedisValue = async key => {
    try {
        const newKey = key.replace(prefix, '');

        const redisValue = await redis.getAsync(newKey);
        const parsedRedisValue = JSON.parse(redisValue);
        // logger.info(`Value from redis by key ${key}: `, parsedRedisValue);
        const result = redisValue ? { redisKey: newKey, ...parsedRedisValue } : false;

        return result;
    } catch (err) {
        logger.error(utils.errorTracing(`Error in getting value of key: ${key}`, err));

        return false;
    }
};

export const getDataFromRedis = async () => {
    try {
        const allKeys = await getRedisKeys();
        const values = await Promise.all(allKeys.map(getRedisValue));
        const filteredValues = values.filter(Boolean);

        return filteredValues.length > 0 ? filteredValues : null;
    } catch (err) {
        logger.error('getDataFromRedis error');

        return null;
    }
};

/**
 * @returns {Promise<object[]>} createRoomData
 */
export const getRedisRooms = async () => {
    try {
        const roomsKeyValue = await redis.getAsync(utils.REDIS_ROOM_KEY);
        const createRoomData = JSON.parse(roomsKeyValue);

        return createRoomData;
    } catch (err) {
        logger.error('getRedisRooms error');

        return null;
    }
};

/**
 * @returns {Promise<string[]>} handledKeys
 */
export const getHandledKeys = async () => {
    try {
        const keys = await redis.getAsync(utils.HANDLED_KEY);
        const handledKeys = JSON.parse(keys);

        return handledKeys || [];
    } catch (err) {
        logger.error('getRedisRooms error');

        return null;
    }
};

export const isHandled = async key => {
    const handledKeys = (await getHandledKeys()) || [];

    return handledKeys.includes(key);
};

export const saveToHandled = async newKeys => {
    const oldKeys = (await getHandledKeys()) || [];
    await redis.setAsync(utils.HANDLED_KEY, JSON.stringify([...oldKeys, ...newKeys]));
};

export const createRoomDataOnlyNew = createRoomData => {
    const createRoomDataByKey = createRoomData
        .map(el => {
            const { issue, projectKey } = el;
            const keyMap = issue ? issue.key : projectKey;

            return { [keyMap]: el };
        })
        .reduce((acc, el) => ({ ...acc, ...el }), {});

    return Object.values(createRoomDataByKey);
};

/**
 * @param {Array} createRoomData array redis room data
 * @returns {Promise<void>} no data
 */
export const rewriteRooms = async createRoomData => {
    const dataForCreateRoom = createRoomDataOnlyNew(createRoomData);
    const bodyToJSON = JSON.stringify(dataForCreateRoom);
    await redis.setAsync(utils.REDIS_ROOM_KEY, bodyToJSON);
    logger.info('Rooms data rewrited by redis.');
};

const getLog = (key, success) => `${key} --- ${success}`;

export const handleRedisData = async (
    client: MessengerFasade,
    dataFromRedis,
    config: Config,
    taskTracker: TaskTracker,
) => {
    try {
        if (!dataFromRedis) {
            logger.warn('No data from redis');

            return;
        }
        const result = await Promise.all(
            dataFromRedis.map(async ({ redisKey, funcName, data }) => {
                try {
                    const chatApi = await client;

                    await bot[funcName]({ ...data, chatApi, config });
                    await redis.delAsync(redisKey);

                    return { redisKey, success: true };
                } catch (err) {
                    const errBody = typeof err === 'string' ? err : err.stack;
                    logger.error(`Error in ${redisKey}\n`, err);

                    if (utils.isNoRoomError(errBody)) {
                        if (await taskTracker.getIssueSafety(utils.getKeyFromError(errBody))) {
                            const key = utils.getKeyFromError(errBody);
                            logger.warn(`Room with key ${key} is not found, trying to create it again`);
                            const newRoomRecord = key.includes('-') ? { issue: { key } } : { projectKey: key };

                            return { redisKey, newRoomRecord, success: false };
                        }

                        await redis.delAsync(redisKey);

                        return { redisKey, success: true };
                    }

                    return { redisKey, success: false };
                }
            }),
        );

        const newRoomRecords = result.map(({ newRoomRecord }) => newRoomRecord).filter(Boolean);
        const logs = result.map(({ redisKey, success }) => getLog(redisKey, success));

        if (newRoomRecords.length) {
            logger.info('This room should be created', JSON.stringify(newRoomRecords));
            const redisRoomsData = (await getRedisRooms()) || [];
            await rewriteRooms([...redisRoomsData, ...newRoomRecords]);
        }

        logger.info('Result of handling redis key', JSON.stringify(logs));
    } catch (err) {
        logger.error('handleRedisData error', err);
    }
};

export const handleRedisRooms = async (client, roomsData) => {
    const roomHandle = async data => {
        try {
            const chatApi = await client;
            await bot.createRoom({ ...data, chatApi });

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

            await rewriteRooms(filteredRooms);
        } else {
            logger.info('All rooms handled');
            await redis.delAsync(utils.REDIS_ROOM_KEY);
        }
    } catch (err) {
        logger.error('handleRedisRooms error', err);
    }
};

export const saveIncoming = async ({ redisKey, ...restData }) => {
    try {
        let redisValue = restData;
        if (redisKey === utils.REDIS_ROOM_KEY) {
            const { createRoomData } = restData;
            if (!createRoomData) {
                logger.warn('No createRoomData!');
                return;
            }

            const dataToAddToRedis = Array.isArray(createRoomData) ? createRoomData : [createRoomData];
            // logger.debug('New data for redis rooms:', dataToAddToRedis);

            const currentRedisRoomData = (await getRedisRooms()) || [];
            redisValue = Ramda.union(currentRedisRoomData, dataToAddToRedis);
        }

        const bodyToJSON = JSON.stringify(redisValue);
        if (redisKey !== utils.REDIS_ROOM_KEY) {
            const handleStatus = await isHandled(redisKey);
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
};

export const handleCommandKeys = async (chatApi, keys, config) => {
    try {
        const result = {};
        for await (const key of keys) {
            const { operationName, projectKey, value, ...options } = key;
            const res = await bot[operationName]({ chatApi, projectKey, config, ...options });
            await redis.srem(operationName, value);

            logger.info(`Result of handling project ${value}`, JSON.stringify(res));

            result[projectKey] = res;
        }

        return result;
    } catch (error) {
        logger.error(error);
    }
};
