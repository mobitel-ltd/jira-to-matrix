const nock = require('nock');
const {expect} = require('chai');
const commentCreatedHook = require('../fixtures/webhooks/comment/created.json');
const issueCommentedHook = require('../fixtures/webhooks/issue/updated/commented.json');
// const issueGenericHook = require('../fixtures/webhooks/issue/updated/generic.json');
const getParsedAndSaveToRedis = require('../../src/jira-hook-parser');
const redis = require('../../src/redis-client.js');
const utils = require('../../src/lib/utils');
const {jira: {url: jiraUrl}} = require('../../src/config');
const {cleanRedis} = require('../test-utils');
const proxyquire = require('proxyquire');
const {stub} = require('sinon');
const translate = require('../../src/locales');

describe('get-parsed-save to redis', () => {
    const redisKey = 'postComment_1512034084304';
    const expected = {
        funcName: 'postComment',
        data: {
            issueID: '26313',
            headerText: translate('comment_created', {name: 'jira_test'}),
            comment: {
                body: '12345',
                id: '31039',
            },
            author: 'jira_test',
        },
    };


    before(() => {
        nock(utils.getRestUrl())
            .get(`/project/${issueCommentedHook.issue.fields.project.id}`)
            .times(5)
            .reply(200, {isPrivate: false})
            .get(`/issue/${utils.getIssueId(commentCreatedHook)}`)
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
        const result1 = utils.isCommentEvent(commentCreatedHook);
        expect(result1).to.be.true;
        const result2 = utils.isCommentEvent(issueCommentedHook);
        expect(result2).to.be.equal(false);
    });

    it('test correct commentCreatedHook parse', async () => {
        await getParsedAndSaveToRedis(commentCreatedHook);

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
        const ignoredBody = {...commentCreatedHook, ...ignoredName};
        const parsedForQueue = await getParsedAndSaveToRedis(ignoredBody);

        expect(parsedForQueue).not.to.be.true;
    });

    it('Expect false to be returned if some error was thrown inside handling', async () => {
        const saveIncoming = stub();
        const getParsedAndSaveToRedisStub = proxyquire('../../src/jira-hook-parser', {
            './bot-handler.js': {
                getFuncAndBody: stub().throws(),
            },
            '../queue/redis-data-handle.js': {saveIncoming},
        });

        let res;
        try {
            res = await getParsedAndSaveToRedisStub(commentCreatedHook);
        } catch (err) {
            res = err;
        }

        expect(res).to.be.false;
        expect(saveIncoming).not.to.be.called;
    });

    // it('Expect hook to be handled and new room creation added if room is not exists in matrix', async () => {
    //     await getParsedAndSaveToRedis(commentCreatedHook);
    //     const
    //     expect()
    // });
});
