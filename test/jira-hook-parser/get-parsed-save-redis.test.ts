import nock from 'nock';
const { expect } from 'chai');
const commentCreatedHook from '../fixtures/webhooks/comment/created.json');
const issueCommentedHook from '../fixtures/webhooks/issue/updated/commented.json');
const getParsedAndSaveToRedis from '../../src/jira-hook-parser');
import { redis } from '../../src/redis-client';
const utils from '../../src/lib/utils');
const {
    jira: { url: jiraUrl },
    usersToIgnore,
    testMode,
} from '../../src/config');
const notIgnoreIssueBody from '../fixtures/jira-api-requests/issue.json');

const { cleanRedis } from '../test-utils');
import { translate } from '../../src/locales';

const issueId = commentCreatedHook.comment.self.split('/').reverse()[2];

describe('get-parsed-save to redis', () => {
    const redisKey = `postComment_${commentCreatedHook.timestamp}`;
    const expected = {
        funcName: 'postComment',
        data: {
            issueID: commentCreatedHook.comment.self.split('/').reverse()[2],
            headerText: translate(commentCreatedHook.webhookEvent, {
                name: commentCreatedHook.comment.author.displayName,
            }),
            comment: {
                body: commentCreatedHook.comment.body,
                id: commentCreatedHook.comment.id,
            },
            author: commentCreatedHook.comment.author.displayName,
        },
    };

    before(() => {
        nock(utils.getRestUrl())
            .get(`/project/${issueCommentedHook.issue.fields.project.id}`)
            .times(5)
            .reply(200, { isPrivate: false })
            .get(`/issue/${issueId}`)
            .times(2)
            .reply(200, notIgnoreIssueBody);
        nock(jiraUrl)
            .get('')
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

    it('Expect comment_created hook to be parsed and save to redis without ignore', async () => {
        await getParsedAndSaveToRedis(commentCreatedHook, usersToIgnore, { ...testMode, on: false });

        const redisValue = await redis.getAsync(redisKey);
        const result = JSON.parse(redisValue);

        expect(result).to.be.deep.equal(expected);
    });
});
