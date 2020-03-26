const logger = require('../modules/log.js')(module);
const {
    getDataFromRedis,
    getRedisRooms,
    handleRedisData,
    handleRedisRooms,
    getCommandKeys,
    handleCommandKeys,
} = require('./redis-data-handle.js');

module.exports = async chatApi => {
    try {
        const redisRooms = await getRedisRooms();
        await handleRedisRooms(chatApi.getCurrentClient(), redisRooms);

        const dataFromRedis = await getDataFromRedis();
        await handleRedisData(chatApi, dataFromRedis);

        const commandKeys = await getCommandKeys();
        await handleCommandKeys(chatApi, commandKeys);
    } catch (err) {
        logger.error('Error in queue handling', err);
    }
};
