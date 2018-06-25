const assert = require('assert');
const firstBody = require('../fixtures/comment-create-1.json');
const secondBody = require('../fixtures/comment-create-2.json');
const parsers = require('../../src/jira-hook-parser/parse-body.js');
const bot = require('../../src/bot');
const {getBotFunc, getParserName, getFuncAndBody, isCommentEvent} = require('../../src/jira-hook-parser/bot-handler.js');
const getParsedAndSaveToRedis = require('../../src/jira-hook-parser');
const conf = require('../fixtures/config.js');
const redis = require('../../src/redis-client.js');

describe('get-parsed-save to redis', function() {
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

        // const expectedData = true;

        assert.ok(parsedForQueue);

        const redisValue = await redis.getAsync(redisKey);
        const keys = await redis.keysAsync(`${prefix}*`);

        const result = JSON.parse(redisValue);
        assert.deepEqual(result, expected);

        await redis.delAsync(redisKey);
        const newResult = await redis.getAsync(redisKey);

        assert.equal(newResult, null);
        // const result = JSON.parse(dataFromRedis);

    });

    it('test ignored body', async () => {
        const ignoredName = {
            comment: {
                author: {
                    name: 'ignore',
                },
            },
        };
        const ignoredBody = {...firstBody, ...ignoredName};
        const parsedForQueue = await getParsedAndSaveToRedis(ignoredBody);
        const expected = false;

        assert.equal(parsedForQueue, false);
    });

    after(async () => {
        const keys = await redis.keysAsync('*');


        if (keys.length > 0) {
            const parsedKeys = keys.map(key => key.replace(`${prefix}`, ''));
            await redis.delAsync(parsedKeys);
        }
    });
});
