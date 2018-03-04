const redis = require('../redis-client');
const logger = require('../modules/log.js')(module);
const {getRedisRooms} = require('../queue/redis-data-handle.js');
const Ramda = require('ramda');

module.exports = async ({redisKey, ...restData}) => {
    try {
        let redisValue = restData;
        if (redisKey === 'rooms') {
            const {createRoomData} = restData;
            if (!createRoomData) {
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
        logger.error(`Error while saving to redis:\n${err.message}`);
        throw err;
    }
};
