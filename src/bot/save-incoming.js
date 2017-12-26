const redis = require('../redis-client');
const logger = require('../modules/log.js')(module);

module.exports = async data => {
    try {
        const {redisKey, ...restData} = data;
        const bodyToJSON = JSON.stringify(restData);

        await redis.setAsync(redisKey, bodyToJSON);
        logger.info('data saved by redis. RedisKey: ', redisKey);
    } catch (err) {
        logger.error(`Error while saving to redis:\n${err.message}`);
        throw err;
    }
};
