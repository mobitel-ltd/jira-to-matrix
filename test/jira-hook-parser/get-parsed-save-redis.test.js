const nock = require('nock');
const {expect} = require('chai');
const firstBody = require('../fixtures/comment-create-1.json');
const secondBody = require('../fixtures/comment-create-2.json');
const getParsedAndSaveToRedis = require('../../src/jira-hook-parser');
const redis = require('../../src/redis-client.js');
const utils = require('../../src/lib/utils');
const {jira: {url: jiraUrl}} = require('../../src/config');
const {cleanRedis} = require('../fixtures/testing-utils');

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


    before(() => {
        nock(utils.getRestUrl())
            .get(`/project/${secondBody.issue.fields.project.id}`)
            .times(5)
            .reply(200, {isPrivate: false})
            .get(`/issue/${utils.extractID(firstBody)}`)
            .times(2)
            .reply(200, {isPrivate: false});
        nock(jiraUrl).get('')
            .times(2)
            .reply(200, '<HTML>');
    });

    afterEach(async () => {
        await cleanRedis();
    });

    after(() => {
        nock.cleanAll();
    });


    it('isCommentEvent', () => {
        const result1 = utils.isCommentEvent(firstBody);
        expect(result1).to.be.true;
        const result2 = utils.isCommentEvent(secondBody);
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
});
