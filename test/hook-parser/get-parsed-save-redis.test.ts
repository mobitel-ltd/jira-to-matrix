import querystring from 'querystring';
import * as R from 'ramda';
import { pipe, set, clone } from 'lodash/fp';
import { stub } from 'sinon';
import nock from 'nock';
import { expect } from 'chai';
import commentCreatedHook from '../fixtures/webhooks/comment/created.json';
import issueCommentedHook from '../fixtures/webhooks/issue/updated/commented.json';
import { redis } from '../../src/redis-client';
import notIgnoreIssueBody from '../fixtures/jira-api-requests/issue.json';
import { cleanRedis, taskTracker, getChatClass } from '../test-utils';
import { translate } from '../../src/locales';
import { config } from '../../src/config';
import { HookParser } from '../../src/hook-parser';
import { QueueHandler } from '../../src/queue';
import { Config } from '../../src/types';
import { Actions } from '../../src/bot/actions';
import { Gitlab } from '../../src/task-trackers/gitlab';
import gitlabCommentCreatedHook from '../fixtures/webhooks/gitlab/commented.json';
import gitlabProjectsJson from '../fixtures/gitlab-api-requests/project-search.gitlab.json';
import gitlabIssueJson from '../fixtures/gitlab-api-requests/issue.json';
import gitlabPushHook from '../fixtures/webhooks/gitlab/push-event.json';

const issueId = commentCreatedHook.comment.self.split('/').reverse()[2];

describe('get-parsed-save to redis', () => {
    const redisKey = `postComment_${commentCreatedHook.timestamp}`;
    const expected = {
        funcName: 'postComment',
        data: {
            issueId: commentCreatedHook.comment.self.split('/').reverse()[2],
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

    const configProdMode: Config = pipe(clone, set('testMode.on', false))(config) as Config;

    const actions = new Actions(configProdMode, taskTracker, getChatClass().chatApi);
    const queueHandler = new QueueHandler(taskTracker, configProdMode, actions);
    const hookParser = new HookParser(taskTracker, configProdMode, queueHandler);

    beforeEach(() => {
        nock(taskTracker.getRestUrl())
            .get(`/project/${issueCommentedHook.issue.fields.project.id}`)
            .times(5)
            .reply(200, { isPrivate: false })
            .get(`/issue/${issueId}`)
            .times(3)
            .reply(200, notIgnoreIssueBody);

        const [endpoint, ...restBase] = config.taskTracker.url.split('/').reverse();
        const baseUrl = restBase.reverse().join('/');
        nock(baseUrl)
            .get('/' + endpoint)
            .times(2)
            .reply(200, '<HTML>');
    });

    afterEach(async () => {
        nock.cleanAll();
        await cleanRedis();
    });

    it('isCommentEvent', () => {
        const result1 = taskTracker.selectors.isCommentEvent(commentCreatedHook);
        expect(result1).to.be.true;
        const result2 = taskTracker.selectors.isCommentEvent(issueCommentedHook);
        expect(result2).to.be.equal(false);
    });

    it('Expect comment_created hook to be parsed and save to redis without ignore', async () => {
        await hookParser.getParsedAndSaveToRedis(commentCreatedHook);

        const redisValue = await redis.getAsync(redisKey);
        const result = JSON.parse(redisValue);

        expect(result).to.be.deep.equal(expected);
    });

    it('Expect comment_created hood created by bot should be ignored', async () => {
        const commentFromBotHook = R.set(
            R.lensPath(['comment', 'updateAuthor', 'displayName']),
            config.taskTracker.user,
            commentCreatedHook,
        );
        const res = await hookParser.getParsedAndSaveToRedis(commentFromBotHook);
        expect(res).to.be.false;

        const redisValue = await redis.getAsync(redisKey);
        expect(redisValue).to.be.null;
    });
});

describe('Queue handler test with gitlab', () => {
    let queueHandler: QueueHandler;
    let hookParser: HookParser;
    let gitlabTracker;

    beforeEach(() => {
        const { chatApi, chatApiSingle } = getChatClass();
        chatApiSingle.getRoomId = stub();
        gitlabTracker = new Gitlab({
            url: 'https://gitlab.test-example.ru',
            user: 'gitlab_bot',
            password: 'fakepasswprd',
            features: config.features,
        });
        const action = new Actions(config, gitlabTracker, chatApi);
        queueHandler = new QueueHandler(gitlabTracker, config, action);
        hookParser = new HookParser(gitlabTracker, config, queueHandler);

        nock(gitlabTracker.getRestUrl())
            .get(`/projects/${querystring.escape(gitlabCommentCreatedHook.project.path_with_namespace)}`)
            .times(4)
            .reply(200, gitlabProjectsJson)
            .get(`/projects/${gitlabProjectsJson.id}/issues/${gitlabCommentCreatedHook.issue.iid}`)
            .times(2)
            .reply(200, gitlabIssueJson);
    });

    afterEach(async () => {
        await cleanRedis();
        nock.cleanAll();
    });

    it('Room data should be in redis', async () => {
        await hookParser.getParsedAndSaveToRedis(gitlabCommentCreatedHook);
        const roomsKeys = await queueHandler.getRedisRooms();
        expect(roomsKeys)
            .to.be.an('array')
            .that.has.length(1);
    });

    it('Comment from bot should be ignored', async () => {
        const commentFromBotHook = R.set(
            R.lensPath(['user']),
            {
                name: 'Some User Name',
                username: config.taskTracker.user,
                avatar_url: 'http://www.gravatar.com/avatar/url',
            },
            gitlabCommentCreatedHook,
        );
        const status = await hookParser.getParsedAndSaveToRedis(commentFromBotHook);
        expect(status).to.be.false;
        const roomsKeys = await queueHandler.getRedisRooms();
        expect(roomsKeys).to.be.null;
    });

    it('Should handle push hook from gitlab', async () => {
        nock(gitlabTracker.getRestUrl())
            .get(`/projects/${gitlabProjectsJson.id}/issues/${57}`)
            .times(4)
            .reply(200, gitlabIssueJson);

        const res = await hookParser.getParsedAndSaveToRedis(gitlabPushHook);
        expect(res).to.be.true;
    });
});
