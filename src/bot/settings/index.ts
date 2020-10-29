import { getLogger } from '../../modules/log';

import { promises } from 'fs';
import Ramda from 'ramda';
import { redis, REDIS_IGNORE_PREFIX, REDIS_INVITE_PREFIX, ARCHIVE_PROJECT, REDIS_ALIASES } from '../../redis-client';

const logger = getLogger(module);

const getPrefix = {
    ignore: REDIS_IGNORE_PREFIX,
    autoinvite: REDIS_INVITE_PREFIX,
};

export const getAllSettingData = async prefix => {
    const data = await redis.getAsync(getPrefix[prefix]);

    return data ? JSON.parse(data) : {};
};

export const getArchiveProject = () => redis.getList(ARCHIVE_PROJECT);

export const setArchiveProject = async (projectKey, options = {}) => {
    const existsProjects = await getArchiveProject();
    if (existsProjects.some(key => key.includes(projectKey))) {
        logger.warn(`${projectKey} is already saved to archive`);

        return false;
    }
    const parsedOptions = Object.entries(options).map(([key, val]) => `${key}=${val}`);
    const value = [projectKey, ...parsedOptions].join('::');

    await redis.addToList(ARCHIVE_PROJECT, value);

    return value;
};

export const getAliases = () => redis.getList(REDIS_ALIASES);

export const setAlias = alias => redis.addToList(REDIS_ALIASES, alias);

export const setSettingsData = async (projectKey, data, prefix) => {
    try {
        const redisSettings = await getAllSettingData(prefix);

        const newSettings = { ...redisSettings, [projectKey]: data };

        await redis.setAsync(getPrefix[prefix], JSON.stringify(newSettings));
        await promises.writeFile(`./backup/${prefix}-list-${Date.now()}.json`, JSON.stringify(newSettings));

        logger.info(`New ${prefix} data was writed by redis.`);
    } catch (err) {
        logger.error(`${prefix} data was not added to redis, ${err}`);
    }
};

export const delSettingsData = async (projectKey, prefix) => {
    try {
        const redisSettings = await getAllSettingData(prefix);

        const fiteredSettingsData = Ramda.omit([projectKey], redisSettings);

        await redis.setAsync(getPrefix[prefix], JSON.stringify(fiteredSettingsData));
        await promises.writeFile(`./backup/${prefix}-list-${Date.now()}.json`, JSON.stringify(fiteredSettingsData));

        logger.info('Key was deleted by redis.');
    } catch (err) {
        logger.error(`Key was not delete from redis, ${err}`);
    }
};
