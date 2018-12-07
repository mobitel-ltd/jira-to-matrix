const nock = require('nock');
const {expect} = require('chai');
const firstBody = require('../fixtures/comment-create-1.json');
const secondBody = require('../fixtures/comment-create-2.json');
const {isCommentEvent} = require('../../src/jira-hook-parser/bot-handler.js');
const getParsedAndSaveToRedis = require('../../src/jira-hook-parser');
const conf = require('../fixtures/config.js');
const redis = require('../../src/redis-client.js');
const utils = require('../../src/lib/utils');
const {jira: {url: jiraUrl}} = require('../../src/config');

describe('get-parsed-save to redis', () => {
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
            author: 'jira_test',
        },
    };

    const {prefix} = conf.redis;

    before(() => {
        nock(jiraUrl)
            .get('')
            .times(2)
            .reply(200, {status: 'OK'})
            .get(`/${utils.JIRA_REST}/project/${secondBody.issue.fields.project.id}`)
            .times(5)
            .reply(200, {isPrivate: false})
            .get(`/${utils.JIRA_REST}/issue/${utils.extractID(firstBody)}`)
            .times(2)
            .reply(200, {isPrivate: false});
    });

    it('isCommentEvent', () => {
        const result1 = isCommentEvent(firstBody);
        expect(result1).to.be.true;
        const result2 = isCommentEvent(secondBody);
        expect(result2).to.be.equal(false);
    });

    it('test correct firstBody parse', async () => {
        const parsedForQueue = await getParsedAndSaveToRedis(firstBody);

        expect(parsedForQueue).to.be;

        const redisValue = await redis.getAsync(redisKey);

        const result = JSON.parse(redisValue);
        expect(result).to.be.deep.equal(expected);

        await redis.delAsync(redisKey);
        const newResult = await redis.getAsync(redisKey);

        expect(newResult).to.be.null;
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

        expect(parsedForQueue).to.be.equal(false);
    });

    after(async () => {
        const keys = await redis.keysAsync('*');


        if (keys.length > 0) {
            const parsedKeys = keys.map(key => key.replace(`${prefix}`, ''));
            await redis.delAsync(parsedKeys);
        }
    });
});
