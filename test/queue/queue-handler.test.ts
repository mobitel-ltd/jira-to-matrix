import issueBody from '../fixtures/jira-api-requests/issue.json';
import deletedLinkBody from '../fixtures/webhooks/issuelink/deleted.json';
import nock from 'nock';
import { stub, SinonStub } from 'sinon';
import sinonChai from 'sinon-chai';
import * as chai from 'chai';
import projectData from '../fixtures/jira-api-requests/project.json';
import JSONbody from '../fixtures/webhooks/issue/created.json';
import { cleanRedis, taskTracker, getChatClass } from '../test-utils';
import { config } from '../../src/config';
import { QueueHandler } from '../../src/queue';
import { HookParser } from '../../src/hook-parser';
import { Actions } from '../../src/bot/actions';
import { Gitlab } from '../../src/task-trackers/gitlab';
import gitlabCommentCreatedHook from '../fixtures/webhooks/gitlab/commented.json';
import gitlabProjectsJson from '../fixtures/gitlab-api-requests/project-search.gitlab.json';
import gitlabIssueJson from '../fixtures/gitlab-api-requests/issue.json';

const { expect } = chai;
chai.use(sinonChai);

describe('Queue handler test', () => {
    let queueHandler: QueueHandler;
    const { sourceIssueId } = deletedLinkBody.issueLink;
    const { destinationIssueId } = deletedLinkBody.issueLink;
    let createRoomStub: SinonStub;
    let hookParser: HookParser;

    beforeEach(() => {
        createRoomStub = stub();
        const { chatApi, chatApiSingle } = getChatClass();
        chatApiSingle.getRoomId = stub();
        const action = new Actions(config, taskTracker, chatApi);
        action.commandsDict.createRoom = { run: createRoomStub as any };
        queueHandler = new QueueHandler(taskTracker, config, action);
        hookParser = new HookParser(taskTracker, config, queueHandler);
        stub(hookParser, 'isIgnore');

        nock(config.taskTracker.url)
            .get('')
            .reply(200, '<HTML>');

        nock(taskTracker.getRestUrl())
            .get(`/project/${projectData.id}`)
            .reply(200, projectData)
            .get(`/issue/${sourceIssueId}`)
            .reply(200, issueBody)
            .get(`/issue/${destinationIssueId}`)
            .reply(200, issueBody);
    });

    afterEach(async () => {
        await cleanRedis();
        nock.cleanAll();
    });

    it('Room should not be created, room should be in redis', async () => {
        await hookParser.getParsedAndSaveToRedis(JSONbody);
        const roomsKeys = await queueHandler.getRedisRooms();
        expect(roomsKeys)
            .to.be.an('array')
            .that.has.length(1);

        createRoomStub.throws('My custom test error');
        await queueHandler.handleRedisRooms(roomsKeys);
        const newRoomsKeys = await queueHandler.getRedisRooms();

        expect(newRoomsKeys)
            .to.be.an('array')
            .that.has.length(1);
        expect(newRoomsKeys).to.deep.equal(roomsKeys);
    });

    it('Expect deleteLink to be handled', async () => {
        await hookParser.getParsedAndSaveToRedis(deletedLinkBody);
        const data = await queueHandler.getDataFromRedis();
        await queueHandler.handleRedisData(data);

        const resKeys = await queueHandler.getDataFromRedis();
        expect(resKeys).to.be.null;
    });
});

describe('Queue handler test with gitlab', () => {
    let queueHandler: QueueHandler;
    let hookParser: HookParser;

    beforeEach(() => {
        const { chatApi, chatApiSingle } = getChatClass();
        chatApiSingle.getRoomId = stub();
        const gitlabTracker = new Gitlab({
            url: 'https://gitlab.test-example.ru',
            user: 'gitlab_bot',
            password: 'fakepasswprd',
            features: config.features,
        });
        const action = new Actions(config, gitlabTracker, chatApi);
        queueHandler = new QueueHandler(gitlabTracker, config, action);
        hookParser = new HookParser(gitlabTracker, config, queueHandler);

        nock(gitlabTracker.getRestUrl())
            .get(`/projects`)
            .times(2)
            .query({ search: gitlabCommentCreatedHook.project.path_with_namespace })
            .reply(200, gitlabProjectsJson)
            .get(`/projects/${gitlabProjectsJson[0].id}/issues/${gitlabCommentCreatedHook.issue.iid}`)
            .times(2)
            .reply(200, gitlabIssueJson);
    });

    afterEach(async () => {
        await cleanRedis();
        nock.cleanAll();
    });

    it('Room should not be created, room should be in redis', async () => {
        await hookParser.getParsedAndSaveToRedis(gitlabCommentCreatedHook);
        const roomsKeys = await queueHandler.getRedisRooms();
        expect(roomsKeys)
            .to.be.an('array')
            .that.has.length(1);
    });
});
