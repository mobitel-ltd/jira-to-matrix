const logger = require('../modules/log.js')(module);
const redis = require('../redis-client.js');
const bot = require('../bot');
const {shouldCreateRoom} = require('./bot-handler.js');
const {createRoom} = require('../bot');

module.exports = async client => {
    try {
        const prefix = process.env.NODE_ENV === 'test' ? 'test-jira-hooks:' : 'jira-hooks:';
        const redisKeys = (await redis.keysAsync(`${prefix}*`))
            .filter(key => key.indexOf('|') === -1);
        logger.debug('Keys from redis', redisKeys);

        const dataFromRedis = await Promise.all(redisKeys.map(async key => {
            const newKey = key.replace(prefix, '');
            logger.debug('key in map', newKey);

            const redisValue = await redis.getAsync(newKey);
            const parsedRedisValue = JSON.parse(redisValue);
            const result = {redisKey: newKey, ...parsedRedisValue};

            return result;
        }));

        dataFromRedis.forEach(value => logger.debug('dataFromRedis', value));

        const botFuncHandlingResult = await Promise.all(dataFromRedis.map(async ({redisKey, funcName, data}) => {
            try {
                const {createRoomData} = data;
                if (shouldCreateRoom(createRoomData)) {
                    await createRoom({...createRoomData, mclient: await client});
                }

                await bot[funcName]({...data, mclient: await client});
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
