const assert = require('assert');
const logger = require('../src/modules/log.js')(module);
const firstBody = require('./fixtures/comment-create-1.json');
const secondBody = require('./fixtures/comment-create-2.json');
const newQueueHandler = require('../src/queue/new-queue-handler.js');
const getParsedAndSaveToRedis = require('../src/queue/get-parsed-and-save-to-redis.js');
const matrixApi = require('../src/matrix/');
const redis = require('../src/redis-client.js');
const {redis: {prefix}} = require('./fixtures/config.js');

describe('new-queue-handler', function() {
    this.timeout(15000);
    const {connect, disconnect} = matrixApi;
    let mclient;

    before(async () => {
        await getParsedAndSaveToRedis(firstBody);
        mclient = await connect();
    })

    it('test new queue handler', async () => {
        // const firstKeys = await redis.keysAsync('*');
        // assert.deepEqual(firstKeys, []);

        const result = await newQueueHandler(mclient);
        assert.ok(result);

        logger('parsedForQueue', result);
        const keys = (await redis.keysAsync('prefix*'))
            .filter(key => key.indexOf('|') === -1);;
        logger('keys', keys);

        assert.deepEqual(keys, []);
    });

    it('test empty array', async () => {
        const result = await newQueueHandler(mclient);
        assert.ok(result);

        logger('parsedForQueue', result);
        const keys = (await redis.keysAsync('prefix*'))
            .filter(key => key.indexOf('|') === -1);;
        logger('keys', keys);

        assert.deepEqual(keys, []);
    });

    after(async () => {
        const keys = await redis.keysAsync('*');
        logger('keys', keys);

        if (keys.length > 0) {
            const parsedKeys = keys.map(key => key.replace('test-jira-hooks:', ''));
            logger('parsedKeys', parsedKeys);
            await redis.delAsync(parsedKeys);
        }

        if (mclient) {
            await disconnect();
        }
    });    
});
