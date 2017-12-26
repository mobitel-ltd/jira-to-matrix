const logger = require('../modules/log.js')(module);
const redis = require('../redis-client.js');
const bot = require('../bot');
const {isCreateRoom} = require('./bot-handler.js');
const {createRoom} = require('../bot');

module.exports = async client => {
    try {
        const prefix = process.env.NODE_ENV === 'test' ? 'test-jira-hooks:' : 'jira-hooks:';
        const allKeys = await redis.keysAsync(`${prefix}*`);
        const redisKeys = allKeys.filter(key => key.indexOf('|') === -1);
        logger.debug('Keys from redis', redisKeys);

        const dataFromRedis = await Promise.all(redisKeys.map(async key => {
            const newKey = key.replace(prefix, '');
            logger.debug('key in map', newKey);

            const redisValue = await redis.getAsync(newKey);
            const parsedRedisValue = JSON.parse(redisValue);
            const result = {redisKey: newKey, ...parsedRedisValue};

            return result;
        }));

        logger.debug('dataFromRedis', dataFromRedis);

        const botFuncHandlingResult = await Promise.all(dataFromRedis.map(async ({redisKey, funcName, data}) => {
            try {
                const mclient = await client;
                const {createRoomData} = data;
                if (isCreateRoom(createRoomData)) {
                    await createRoom({...createRoomData, mclient});
                }

                await bot[funcName]({...data, mclient});
                await redis.delAsync(redisKey);

                return `${redisKey} --- true`;
            } catch (err) {
                logger.error(`Error in ${funcName}`, err);

                return `${redisKey} --- false`;
            }
        }));
        botFuncHandlingResult.forEach(value => logger.info('Result of handling redis key', value));

        return true;
    } catch (err) {
        logger.error('Error in queue handling', err);
    }
};
