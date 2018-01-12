const logger = require('../modules/log.js')(module);
const {getDataFromRedis, getRedisRooms, handleRedisData, handleRedisRooms} = require('./redis-data-handle.js');

module.exports = async client => {
    try {
        const redisRooms = await getRedisRooms();
        await handleRedisRooms(client, redisRooms);

        const dataFromRedis = await getDataFromRedis();
        await handleRedisData(client, dataFromRedis);
    } catch (err) {
        logger.error('Error in queue handling', err);
    }
};
