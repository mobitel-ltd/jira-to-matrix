const logger = require('../modules/log.js')(module);
const { getDataFromRedis, getRedisRooms, handleRedisData, handleRedisRooms } = require('./redis-data-handle.js');

module.exports = async chatApi => {
    try {
        const redisRooms = await getRedisRooms();
        await handleRedisRooms(chatApi.getCurrentClient(), redisRooms);

        const dataFromRedis = await getDataFromRedis();
        await handleRedisData(chatApi, dataFromRedis);
    } catch (err) {
        logger.error('Error in queue handling', err);
    }
};
