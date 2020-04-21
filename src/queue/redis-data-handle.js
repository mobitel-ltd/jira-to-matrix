// @ts-check

const Ramda = require('ramda');
const logger = require('../modules/log.js')(module);
const redis = require('../redis-client.js');
const bot = require('../bot/actions');
const { prefix } = require('../config').redis;
const { REDIS_ROOM_KEY, isIgnoreKey, HANDLED_KEY, ARCHIVE_PROJECT } = require('../lib/utils.js');
const jiraRequest = require('../lib/jira-request');
const utils = require('../lib/utils');

const getRedisKeys = async () => {
    try {
        const allKeys = await redis.keysAsync(`${prefix}*`);
        return allKeys.filter(isIgnoreKey);
    } catch (err) {
        throw ['getRedisKeys error', err].join('\n');
    }
};

const getCommandKeys = async () => {
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
        logger.error(utils.errorTracing('Error in getting command keys values', error));
        return false;
    }
};

const getRedisValue = async key => {
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

const getDataFromRedis = async () => {
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
const getRedisRooms = async () => {
    try {
        const roomsKeyValue = await redis.getAsync(REDIS_ROOM_KEY);
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
const getHandledKeys = async () => {
    try {
        const keys = await redis.getAsync(HANDLED_KEY);
        const handledKeys = JSON.parse(keys);

        return handledKeys || [];
    } catch (err) {
        logger.error('getRedisRooms error');

        return null;
    }
};

const isHandled = async key => {
    const handledKeys = (await getHandledKeys()) || [];

    return handledKeys.includes(key);
};

const saveToHandled = async newKeys => {
    const oldKeys = (await getHandledKeys()) || [];
    await redis.setAsync(HANDLED_KEY, JSON.stringify([...oldKeys, ...newKeys]));
};

const createRoomDataOnlyNew = createRoomData => {
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
const rewriteRooms = async createRoomData => {
    const dataForCreateRoom = createRoomDataOnlyNew(createRoomData);
    const bodyToJSON = JSON.stringify(dataForCreateRoom);
    await redis.setAsync(REDIS_ROOM_KEY, bodyToJSON);
    logger.info('Rooms data rewrited by redis.');
};

const getLog = (key, success) => `${key} --- ${success}`;

const handleRedisData = async (client, dataFromRedis, config) => {
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
                        if (await jiraRequest.getIssueSafety(utils.getKeyFromError(errBody))) {
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

const handleRedisRooms = async (client, roomsData) => {
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
            await redis.delAsync(REDIS_ROOM_KEY);
        }
    } catch (err) {
        logger.error('handleRedisRooms error', err);
    }
};

const saveIncoming = async ({ redisKey, ...restData }) => {
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

            const currentRedisRoomData = (await getRedisRooms()) || [];
            redisValue = Ramda.union(currentRedisRoomData, dataToAddToRedis);
        }

        const bodyToJSON = JSON.stringify(redisValue);
        if (redisKey !== REDIS_ROOM_KEY) {
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

const handleCommandKeys = async (chatApi, keys, config) => {
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

module.exports = {
    handleCommandKeys,
    getCommandKeys,
    rewriteRooms,
    saveIncoming,
    getRedisKeys,
    getDataFromRedis,
    getRedisRooms,
    handleRedisData,
    handleRedisRooms,
    getRedisValue,
    createRoomDataOnlyNew,
    getHandledKeys,
    saveToHandled,
};
