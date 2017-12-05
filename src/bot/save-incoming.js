const redis = require('../redis-client');
const conf = require('../config');
const logger = require('debug')('bot save incoming');

const save = async req => {
    try {
        if (!req.jiraKey) {
            throw new Error('No jiraKey');
        }
        await redis.setAsync(req.jiraKey, req.formattedJSON, 'EX', conf.redis.ttl);
        logger('data saved by redis');
    } catch (err) {
        logger(`Error while saving to redis:\n${err.message}`);
        throw err;
    }
};

const newSave = async data => {
    try {
        const {redisKey, ...restData} = data;
        // logger('restData', restData);
        // logger('data', redisKey);
        const bodyToJSON = JSON.stringify(restData);

        await redis.setAsync(redisKey, bodyToJSON);
        logger('data saved by redis');
    } catch (err) {
        logger(`Error while saving to redis:\n${err.message}`);
        throw err;
    }
};


module.exports = {save, newSave};
