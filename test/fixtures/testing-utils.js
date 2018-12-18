const {prefix} = require('../fixtures/config.js').redis;
const redis = require('../../src/redis-client.js');

module.exports = {
    cleanRedis: async () => {
        const keys = await redis.keysAsync('*');

        if (keys.length > 0) {
            const parsedKeys = keys.map(key => key.replace(`${prefix}`, ''));
            await redis.delAsync(parsedKeys);
        }
    },
};
