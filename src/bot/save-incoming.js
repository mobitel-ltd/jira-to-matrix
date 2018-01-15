const redis = require('../redis-client');
const logger = require('../modules/log.js')(module);

module.exports = async ({redisKey, ...restData}) => {
    try {
        let redisValue = restData;
        if (redisKey === 'rooms') {
            const {createRoomData} = restData;
            if (!createRoomData) {
                return;
            }

            const currentRedisRoomData = await redis.getAsync('rooms');
            const currentRedisRoomDataParsed = JSON.parse(currentRedisRoomData);

            redisValue = currentRedisRoomDataParsed
                ? [...currentRedisRoomDataParsed, createRoomData]
                : [createRoomData];
        }

        const bodyToJSON = JSON.stringify(redisValue);

        await redis.setAsync(redisKey, bodyToJSON);
        logger.info('data saved by redis. RedisKey: ', redisKey);
    } catch (err) {
        logger.error(`Error while saving to redis:\n${err.message}`);
        throw err;
    }
};
