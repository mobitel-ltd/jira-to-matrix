const redis = require('redis');
const conf = require('./config');
const logger = require('./modules/log.js')(module);
const { promisify } = require('util');
const { getRedisLinkKey } = require('./lib/utils');

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

const setnxAsync = promisify(client.setnx).bind(client);
const sismemberAsync = promisify(client.sismember).bind(client);
const saddAsync = promisify(client.sadd).bind(client);

module.exports = {
    getAsync: promisify(client.get).bind(client),
    setAsync: promisify(client.set).bind(client),
    delAsync: promisify(client.del).bind(client),
    keysAsync: promisify(client.keys).bind(client),
    hasChild: (redisEpicKey, issueID) => sismemberAsync(redisEpicKey, issueID),
    saveToEpic: (redisEpicKey, issueID) => saddAsync(redisEpicKey, issueID),
    isNewLink: id => setnxAsync(getRedisLinkKey(id), '1'),
};
