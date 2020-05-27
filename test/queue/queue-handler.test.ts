import issueBody from '../fixtures/jira-api-requests/issue.json';
import deletedLinkBody from '../fixtures/webhooks/issuelink/deleted.json';
import nock from 'nock';
import { stub, SinonStub } from 'sinon';
import sinonChai from 'sinon-chai';
import * as utils from '../../src/lib/utils';
import * as chai from 'chai';
import projectData from '../fixtures/jira-api-requests/project.json';
import JSONbody from '../fixtures/webhooks/issue/created.json';
import { cleanRedis, taskTracker, getChatClass } from '../test-utils';
import { config } from '../../src/config';
import { QueueHandler } from '../../src/queue';
import * as botActions from './../../src/bot/actions';
import { HookParser } from '../../src/hook-parser';

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
        const actions = { ...botActions, createRoom: createRoomStub };
        queueHandler = new QueueHandler(taskTracker, chatApi, config, actions);
        hookParser = new HookParser(taskTracker, config, queueHandler);
        stub(hookParser, 'isIgnore');

        nock(config.jira.url)
            .get('')
            .reply(200, '<HTML>');

        nock(utils.getRestUrl())
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

        createRoomStub.throws('Incorrect room data');
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
