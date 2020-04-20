const logger = require('../modules/log.js')(module);
const {
    getDataFromRedis,
    getRedisRooms,
    handleRedisData,
    handleRedisRooms,
    getCommandKeys,
    handleCommandKeys,
} = require('./redis-data-handle.js');
const config = require('../config');

module.exports = async chatApi => {
    try {
        const redisRooms = await getRedisRooms();
        await handleRedisRooms(chatApi.getCurrentClient(), redisRooms);

        const dataFromRedis = await getDataFromRedis();
        await handleRedisData(chatApi, dataFromRedis, config);

        const commandKeys = await getCommandKeys();
        await handleCommandKeys(chatApi, commandKeys, config);
    } catch (err) {
        logger.error('Error in queue handling', err);
    }
};
