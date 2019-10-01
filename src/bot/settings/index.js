const Ramda = require('ramda');
const redis = require('../../redis-client');
const utils = require('../../lib/utils.js');
const logger = require('../../modules/log')(module);

const getIgnoreList = async () => {
    const result = await redis.getAsync(utils.REDIS_IGNORE_PREFIX);
    return result ? result : 'Ignore list is empty.';
};

const setIgnoreData = async (project, data) => {
    try {
        const result = await redis.getAsync(utils.REDIS_IGNORE_PREFIX);
        const redisIgnore = JSON.parse(result);

        const newIgnore = {...redisIgnore, [project]: data};

        await redis.setAsync(utils.REDIS_IGNORE_PREFIX, JSON.stringify(newIgnore));

        logger.info('New ignore data was writed by redis.');
    } catch (err) {
        logger.error(`Ignore data was not added to redis, ${err}`);
    }
};

const delIgnoreData = async project => {
    try {
        const result = await redis.getAsync(utils.REDIS_IGNORE_PREFIX);
        const redisIgnore = JSON.parse(result);

        const fiteredIgnoreData = Ramda.omit([project], redisIgnore);

        await redis.setAsync(utils.REDIS_IGNORE_PREFIX, JSON.stringify(fiteredIgnoreData));

        logger.info('Key was deleted by redis.');
    } catch (err) {
        logger.error(`Key was not delete from redis, ${err}`);
    }
};

module.exports = {
    getIgnoreList,
    setIgnoreData,
    delIgnoreData,
};
