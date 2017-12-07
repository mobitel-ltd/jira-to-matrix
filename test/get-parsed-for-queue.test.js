const assert = require('assert');
const logger = require('debug')('get-parsed-for-queue');
const firstBody = require('./fixtures/comment-create-1.json');
const secondBody = require('./fixtures/comment-create-2.json');
const parsers = require('../src/queue/parse-body.js');
const bot = require('../src/bot');
const {getBotFunc, getParserName, getFuncAndBody} = require('../src/queue/bot-handler.js');
const getParsedAndSaveToRedis = require('../src/queue/get-parsed-and-save-to-redis.js');
const conf = require('./fixtures/config.js');
const redis = require('../src/redis-client.js');

describe('get-bot-data', function() {
    const redisKey = 'postComment_1512034084304';
    const expected = {
        funcName: 'postComment',
        data: {
            createRoomData: null,
            issueID: '26313',
            headerText: 'jira_test добавил(а) комментарий',
            comment: { 
                body: '12345', 
                id: '31039', 
            },
            author: 'jira_test' 
        },
    };

    const {prefix} = conf.redis;

    it('test correct firstBody parse', async () => {
        const parsedForQueue = await getParsedAndSaveToRedis(firstBody);
        logger('parsedForQueue', parsedForQueue);

        // const expectedData = true;

        assert.ok(parsedForQueue);

        const redisValue = await redis.getAsync(redisKey);
        const keys = await redis.keysAsync(`${prefix}*`);
        logger('keys', keys);
        
        logger('redisValue', redisValue);
        const result = JSON.parse(redisValue);
        logger('result', result);
        assert.deepEqual(result, expected);

        await redis.delAsync(redisKey);
        const newResult = await redis.getAsync(redisKey);
        logger('newResult', newResult);
        
        assert.equal(newResult, null);
        // const result = JSON.parse(dataFromRedis);

    });

    it('test ignored body', async () => {
        const ignoredName = {
            comment: {
                author: {
                    name: 'ivan',
                },
            },
        };
        const ignoredBody = {...firstBody, ...ignoredName};
        logger('ignoredBody', ignoredBody);
        const parsedForQueue = await getParsedAndSaveToRedis(ignoredBody);
        logger('parsedForQueue', parsedForQueue);
        const expected = false;

        assert.equal(parsedForQueue, false);
    });

    after(async () => {
        const keys = await redis.keysAsync('*');
        logger('keys', keys);


        if (keys.length > 0) {
            const parsedKeys = keys.map(key => key.replace(`${prefix}`, ''));
            logger('parsedKeys', parsedKeys);
            await redis.delAsync(parsedKeys);
        }
    });
});
