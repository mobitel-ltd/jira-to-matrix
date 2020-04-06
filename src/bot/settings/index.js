const { writeFile } = require('fs').promises;
const Ramda = require('ramda');
const redis = require('../../redis-client');
const utils = require('../../lib/utils.js');
const logger = require('../../modules/log')(module);

const getPrefix = {
    ignore: utils.REDIS_IGNORE_PREFIX,
    autoinvite: utils.REDIS_INVITE_PREFIX,
};

const getAllSettingData = async prefix => {
    const data = await redis.getAsync(getPrefix[prefix]);

    return data ? JSON.parse(data) : {};
};

const getArchiveProject = () => redis.getList(utils.ARCHIVE_PROJECT);

const setArchiveProject = async (projectKey, options = {}) => {
    const existsProjects = await getArchiveProject();
    if (existsProjects.some(key => key.includes(projectKey))) {
        logger.warn(`${projectKey} is already saved to archive`);

        return false;
    }
    const parsedOptions = Object.entries(options).map(([key, val]) => `${key}=${val}`);
    const value = [projectKey, ...parsedOptions].join('::');

    await redis.addToList(utils.ARCHIVE_PROJECT, value);

    return value;
};

const getAliases = () => redis.getList(utils.REDIS_ALIASES);

const setAlias = alias => redis.addToList(utils.REDIS_ALIASES, alias);

const setSettingsData = async (projectKey, data, prefix) => {
    try {
        const redisSettings = await getAllSettingData(prefix);

        const newSettings = { ...redisSettings, [projectKey]: data };

        await redis.setAsync(getPrefix[prefix], JSON.stringify(newSettings));
        await writeFile(`./backup/${prefix}-list-${Date.now()}.json`, JSON.stringify(newSettings));

        logger.info(`New ${prefix} data was writed by redis.`);
    } catch (err) {
        logger.error(`${prefix} data was not added to redis, ${err}`);
    }
};

const delSettingsData = async (projectKey, prefix) => {
    try {
        const redisSettings = await getAllSettingData(prefix);

        const fiteredSettingsData = Ramda.omit([projectKey], redisSettings);

        await redis.setAsync(getPrefix[prefix], JSON.stringify(fiteredSettingsData));
        await writeFile(`./backup/${prefix}-list-${Date.now()}.json`, JSON.stringify(fiteredSettingsData));

        logger.info('Key was deleted by redis.');
    } catch (err) {
        logger.error(`Key was not delete from redis, ${err}`);
    }
};

const getAutoinviteUsers = async (projectKey, typeName) => {
    const dataJSON = await redis.getAsync(getPrefix.autoinvite);
    const data = dataJSON ? JSON.parse(dataJSON) : {};
    const { [projectKey]: currentInvite = {} } = data;
    const { [typeName]: autoinviteUsers = [] } = currentInvite;
    return autoinviteUsers;
};

module.exports = {
    setArchiveProject,
    getArchiveProject,
    setAlias,
    getAliases,
    getAllSettingData,
    getAutoinviteUsers,
    setSettingsData,
    delSettingsData,
};
