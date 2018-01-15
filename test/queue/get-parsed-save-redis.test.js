const assert = require('assert');
const logger = require('../../src/modules/log.js')(module);
const firstBody = require('../fixtures/comment-create-1.json');
const secondBody = require('../fixtures/comment-create-2.json');
const parsers = require('../../src/queue/parse-body.js');
const bot = require('../../src/bot');
const {getBotFunc, getParserName, getFuncAndBody, isCommentEvent} = require('../../src/queue/bot-handler.js');
const getParsedAndSaveToRedis = require('../../src/queue/get-parsed-and-save-to-redis.js');
const conf = require('../fixtures/config.js');
const redis = require('../../src/redis-client.js');

describe('get-bot-data', function() {
    const redisKey = 'postComment_1512034084304';
    const expected = {
        funcName: 'postComment',
        data: {
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

    it('isCommentEvent', () => {
        const result1 = isCommentEvent(firstBody);
        assert.ok(result1);
        const result2 = isCommentEvent(secondBody);
        assert.equal(result2, false);
    })

    it('test correct firstBody parse', async () => {
        const parsedForQueue = await getParsedAndSaveToRedis(firstBody);
        logger.debug('parsedForQueue', parsedForQueue);

        // const expectedData = true;

        assert.ok(parsedForQueue);

        const redisValue = await redis.getAsync(redisKey);
        const keys = await redis.keysAsync(`${prefix}*`);
        logger.debug('keys', keys);

        logger.debug('redisValue', redisValue);
        const result = JSON.parse(redisValue);
        logger.debug('result', result);
        assert.deepEqual(result, expected);

        await redis.delAsync(redisKey);
        const newResult = await redis.getAsync(redisKey);
        logger.debug('newResult', newResult);

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
        logger.debug('ignoredBody', ignoredBody);
        const parsedForQueue = await getParsedAndSaveToRedis(ignoredBody);
        logger.debug('parsedForQueue', parsedForQueue);
        const expected = false;

        assert.equal(parsedForQueue, false);
    });

    after(async () => {
        const keys = await redis.keysAsync('*');
        logger.debug('keys', keys);


        if (keys.length > 0) {
            const parsedKeys = keys.map(key => key.replace(`${prefix}`, ''));
            logger.debug('parsedKeys', parsedKeys);
            await redis.delAsync(parsedKeys);
        }
    });
});
