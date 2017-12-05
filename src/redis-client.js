// @flow
const redis = require('redis');
const bluebird = require('bluebird');
const conf = require('./config');
const logger = require('debug')('redis client');
// const fakeRedis = require('fakeredis');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);
// const env = process.env.NODE_ENV;

const createClient = config => {
    let result;
    try {
        // result = (env === 'test') ? fakeRedis.createClient(config) : redis.createClient(config);
        result = redis.createClient(config);
    } catch (error) {
        logger(`Error while creating redis client ${error}`);
        process.exit(1);
    }
    return result;
};

const client = createClient(conf.redis);

client.on('error', err => {
    logger(`Redis error:\n${err}`);
    if (/\bECONNREFUSED\b/.test(err.message || '')) {
        process.exit(1);
    }
});

module.exports = client;
