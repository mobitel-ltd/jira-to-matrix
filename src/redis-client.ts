import * as redisApi from 'redis';
import { config } from './config';
import { promisify } from 'util';
import { getRedisLinkKey } from './lib/utils';
import { getLogger } from './modules/log';

const logger = getLogger(module);

const createClient = conf => {
    try {
        return redisApi.createClient(conf);
    } catch (err) {
        logger.error(`Error while creating redis client`, err);
        process.exit(1);
    }
};

const client = createClient(config.redis);

client.on('error', err => {
    logger.error('Redis error:', err);
    if (/\bECONNREFUSED\b/.test(err.message || '')) {
        process.exit(1);
    }
});

const setnxAsync = promisify(client.setnx).bind(client);
const sismemberAsync = promisify(client.sismember).bind(client);
const saddAsync = promisify(client.sadd).bind(client);

export const redis = {
    getAsync: promisify(client.get).bind(client),
    setAsync: promisify(client.set).bind(client),
    delAsync: promisify(client.del).bind(client),
    keysAsync: promisify(client.keys).bind(client),
    isInEpic: (redisEpicKey, issueID) => sismemberAsync(redisEpicKey, issueID),
    addToList: (list, id) => saddAsync(list, id),
    getList: promisify(client.smembers).bind(client),
    isNewLink: id => setnxAsync(getRedisLinkKey(id), '1'),
    srem: promisify(client.srem).bind(client),
};
