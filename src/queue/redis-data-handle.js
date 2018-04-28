const Ramda = require('ramda');
const logger = require('../modules/log.js')(module);
const redis = require('../redis-client.js');
const bot = require('../bot');
const {prefix} = require('../config').redis;
const {REDIS_ROOM_KEY, isIgnoreKey} = require('../lib/utils.js');

const getRedisKeys = async () => {
    try {
        const allKeys = await redis.keysAsync(`${prefix}*`);
        return allKeys.filter(isIgnoreKey);
    } catch (err) {
        throw ['getRedisKeys error', err].join('\n');
    }
};

const getRedisValue = async key => {
    try {
        const newKey = key.replace(prefix, '');

        const redisValue = await redis.getAsync(newKey);
        const parsedRedisValue = JSON.parse(redisValue);
        logger.info(`Value from redis by key ${key}: `, parsedRedisValue);
        const result = redisValue ? {redisKey: newKey, ...parsedRedisValue} : false;

        return result;
    } catch (err) {
        logger.error(`Error in getting value of key: ${key}\n`, err);

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

const handleRedisData = async (client, dataFromRedis) => {
    try {
        if (!dataFromRedis) {
            logger.warn('No data from redis');

            return;
        }
        const result = await Promise.all(dataFromRedis.map(async ({redisKey, funcName, data}) => {
            try {
                const mclient = await client;

                await bot[funcName]({...data, mclient});
                await redis.delAsync(redisKey);

                return `${redisKey} --- true`;
            } catch (err) {
                logger.error(`Error in ${redisKey}\n`, err);

                return `${redisKey} --- false`;
            }
        }));

        logger.info('Result of handling redis key', result);
    } catch (err) {
        logger.error('handleRedisData error', err);
    }
};

const getRedisRooms = async () => {
    try {
        const roomsKeyValue = await redis.getAsync(REDIS_ROOM_KEY);
        const createRoomData = JSON.parse(roomsKeyValue);
        logger.debug('Redis rooms data:', createRoomData);

        return createRoomData;
    } catch (err) {
        logger.error('getRedisRooms error');

        return null;
    }
};

const rewriteRooms = async createRoomData => {
    try {
        const bodyToJSON = JSON.stringify(createRoomData);

        await redis.setAsync(REDIS_ROOM_KEY, bodyToJSON);
        logger.info('Rooms data rewrited by redis.');
    } catch (err) {
        throw ['Error while rewrite rooms in redis:', err].join('\n');
    }
};

const handleRedisRooms = async (client, roomsData) => {
    const roomHandle = async data => {
        try {
            const mclient = await client;
            await bot.createRoom({...data, mclient});

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
            logger.warn('Rooms which not created', filteredRooms);

            await rewriteRooms(filteredRooms);
        } else {
            logger.info('All rooms handled');
            await redis.delAsync(REDIS_ROOM_KEY);
        }
    } catch (err) {
        logger.error('handleRedisRooms error', err);
    }
};


const saveIncoming = async ({redisKey, ...restData}) => {
    try {
        let redisValue = restData;
        if (redisKey === REDIS_ROOM_KEY) {
            const {createRoomData} = restData;
            if (!createRoomData) {
                logger.warn('No createRoomData!');
                return;
            }

            const dataToAddToRedis = Array.isArray(createRoomData) ? createRoomData : [createRoomData];
            logger.debug('New data for redis rooms:', dataToAddToRedis);

            const currentRedisRoomData = await getRedisRooms() || [];
            redisValue = Ramda.union(currentRedisRoomData, dataToAddToRedis);
        }

        const bodyToJSON = JSON.stringify(redisValue);

        await redis.setAsync(redisKey, bodyToJSON);
        logger.info('data saved by redis. RedisKey: ', redisKey);
    } catch (err) {
        throw ['Error while saving to redis:', err].join('\n');
    }
};

module.exports = {
    rewriteRooms,
    saveIncoming,
    getRedisKeys,
    getDataFromRedis,
    getRedisRooms,
    handleRedisData,
    handleRedisRooms,
    getRedisValue,
};
