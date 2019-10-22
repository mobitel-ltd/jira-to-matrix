const { writeFile } = require('fs').promises;
const Ramda = require('ramda');
const redis = require('../../redis-client');
const utils = require('../../lib/utils.js');
const logger = require('../../modules/log')(module);

const getAllIgnoreData = async () => {
    const data = await redis.getAsync(utils.REDIS_IGNORE_PREFIX);

    return data ? JSON.parse(data) : {};
};

const setIgnoreData = async (projectKey, data) => {
    try {
        const redisIgnore = await getAllIgnoreData();

        const newIgnore = { ...redisIgnore, [projectKey]: data };

        await redis.setAsync(utils.REDIS_IGNORE_PREFIX, JSON.stringify(newIgnore));
        await writeFile(`./backup/ignore-list-${Date.now()}.json`, JSON.stringify(newIgnore));

        logger.info('New ignore data was writed by redis.');
    } catch (err) {
        logger.error(`Ignore data was not added to redis, ${err}`);
    }
};

const delIgnoreData = async projectKey => {
    try {
        const redisIgnore = await getAllIgnoreData();

        const fiteredIgnoreData = Ramda.omit([projectKey], redisIgnore);

        await redis.setAsync(utils.REDIS_IGNORE_PREFIX, JSON.stringify(fiteredIgnoreData));
        await writeFile(`./backup/ignore-list-${Date.now()}.json`, JSON.stringify(fiteredIgnoreData));

        logger.info('Key was deleted by redis.');
    } catch (err) {
        logger.error(`Key was not delete from redis, ${err}`);
    }
};

module.exports = {
    getAllIgnoreData,
    setIgnoreData,
    delIgnoreData,
};
