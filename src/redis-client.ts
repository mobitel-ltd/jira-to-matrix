import * as redisApi from 'redis';
import { config } from './config';
import { promisify } from 'util';
import { getLogger } from './modules/log';

const logger = getLogger(module);

export const REDIS_ROOM_KEY = 'newrooms';
export const REDIS_LINK_PREFIX = 'link';
export const REDIS_EPIC_PREFIX = 'epic';
export const MILESTONE_PREFIX = 'milestone';

export const DELIMITER = '|';

const ROOMS_OLD_NAME = 'rooms';
export const REDIS_IGNORE_PREFIX = 'ignore:project';
export const REDIS_INVITE_PREFIX = 'invite:project';
export const REDIS_ALIASES = 'aliases';
export const HANDLED_KEY = 'handled';
export const ARCHIVE_PROJECT = 'archiveProject';
export const LAST_STATUS_COLOR = 'green';

export const KEYS_TO_IGNORE = [
    REDIS_ALIASES,
    ROOMS_OLD_NAME,
    DELIMITER,
    REDIS_IGNORE_PREFIX,
    REDIS_INVITE_PREFIX,
    HANDLED_KEY,
    ARCHIVE_PROJECT,
];

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
const sremAsync = promisify(client.srem).bind(client);

export const getRedisLinkKey = id => [REDIS_LINK_PREFIX, DELIMITER, id].join('');

export const redis = {
    getAsync: promisify(client.get).bind(client),
    setAsync: promisify(client.set).bind(client),
    delAsync: promisify(client.del).bind(client),
    keysAsync: promisify(client.keys).bind(client),
    isInEpic: (redisEpicKey, issueId) => sismemberAsync(redisEpicKey, issueId),
    isInMilestone: (milestoneKey, issueId) => sismemberAsync(milestoneKey, issueId),
    addToList: (list, id) => saddAsync(list, id),
    remFromList: (list, id) => sremAsync(list, id),
    getList: promisify(client.smembers).bind(client),
    isNewLink: id => setnxAsync(getRedisLinkKey(id), '1'),
    srem: promisify(client.srem).bind(client),
};

export const getRedisEpicKey = id => [REDIS_EPIC_PREFIX, DELIMITER, id].join('');
export const getRedisMilestoneKey = id => [MILESTONE_PREFIX, DELIMITER, id].join('');

export const isIgnoreKey = key => !KEYS_TO_IGNORE.some(val => key.includes(val));
