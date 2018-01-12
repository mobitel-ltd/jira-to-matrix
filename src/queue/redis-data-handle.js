const logger = require('../modules/log.js')(module);
const redis = require('../redis-client.js');
const bot = require('../bot');

const {createRoom, newSave} = bot;
const roomsKeyName = 'rooms';
const prefix = process.env.NODE_ENV === 'test' ? 'test-jira-hooks:' : 'jira-hooks:';

const getRedisKeys = async () => {
    try {
        const allKeys = await redis.keysAsync(`${prefix}*`);
        const redisKeys = allKeys.filter(key => key.indexOf('|') === -1 && key.indexOf('rooms') === -1);

        return redisKeys;
    } catch (err) {
        logger.error('getRedisKeys error');

        throw err;
    }
};

const getDataFromRedis = async () => {
    try {
        const allKeys = await getRedisKeys();
        const result = await Promise.all(allKeys.map(async key => {
            const newKey = key.replace(prefix, '');

            const redisValue = await redis.getAsync(newKey);
            const parsedRedisValue = JSON.parse(redisValue);
            const result = {redisKey: newKey, ...parsedRedisValue};

            return result;
        }));
        logger.debug('dataFromRedis', result);

        return result;
    } catch (err) {
        logger.error('getDataFromRedis error');

        throw err;
    }
};

const getRedisRooms = async () => {
    try {
        const roomsKeyValue = await redis.getAsync(roomsKeyName);
        const createRoomData = JSON.parse(roomsKeyValue) || [];
        logger.debug('Redis rooms data', createRoomData);

        return createRoomData;
    } catch (err) {
        logger.error('getRedisRooms error');

        throw err;
    }
};

const handleRedisRooms = async (client, roomsData = []) => {
    try {
        const handledRooms = await Promise.all(roomsData.map(async data => {
            try {
                const mclient = await client;
                await createRoom({...data, mclient});

                return null;
            } catch (err) {
                logger.error('Error in newRoomsData. Data is ', data);
                logger.error('Error log', err);

                return data;
            }
        }));
        const filteredRooms = handledRooms.filter(Boolean);
        if (filteredRooms.length > 0) {
            logger.warn('Rooms which not created', filteredRooms);

            const dataToSave = {
                redisKey: roomsKeyName,
                createRoomData: filteredRooms,
            };
            await newSave(dataToSave);
        } else {
            logger.info('All rooms handled');
            await redis.delAsync(roomsKeyName);
        }
    } catch (err) {
        logger.error('handleRedisData error', err);
    }
};


const handleRedisData = async (client, dataFromRedis) => {
    try {
        const result = await Promise.all(dataFromRedis.map(async ({redisKey, funcName, data}) => {
            try {
                const mclient = await client;

                await bot[funcName]({...data, mclient});
                await redis.delAsync(redisKey);

                return `${redisKey} --- true`;
            } catch (err) {
                logger.error(`Error in ${funcName}`, err);

                return `${redisKey} --- false`;
            }
        }));

        logger.info('Result of handling redis key', result);
    } catch (err) {
        logger.error('handleRedisData error', err);
    }
};

module.exports = {
    getRedisKeys,
    getDataFromRedis,
    getRedisRooms,
    handleRedisData,
    handleRedisRooms,
};
