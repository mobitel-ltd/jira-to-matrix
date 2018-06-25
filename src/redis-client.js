const redis = require('redis');
const bluebird = require('bluebird');
const conf = require('./config');
const logger = require('./modules/log.js')(module);

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const createClient = config => {
    try {
        return redis.createClient(config);
    } catch (err) {
        logger.error(`Error while creating redis client`, err);
        process.exit(1);
    }
};

const client = createClient(conf.redis);

client.on('error', err => {
    logger.error('Redis error:', err);
    if (/\bECONNREFUSED\b/.test(err.message || '')) {
        process.exit(1);
    }
});

module.exports = client;
