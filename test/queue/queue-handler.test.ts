const issueBody from '../fixtures/jira-api-requests/issue.json');
const deletedLinkBody from '../fixtures/webhooks/issuelink/deleted.json');
/* eslint {no-unused-expressions: 0, max-nested-callbacks: 0, global-require: 0} */
import nock from 'nock';
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';
import proxyquire from 'proxyquire';
import * as chai from 'chai';

const {
    jira: { url: jiraUrl },
} from '../../src/config');
const utils from '../../src/lib/utils');
const projectData from '../fixtures/jira-api-requests/project.json');
const JSONbody from '../fixtures/webhooks/issue/created.json');
const { cleanRedis } from '../test-utils');
const createRoomStub = stub();

const { getRedisRooms, handleRedisRooms, handleRedisData, getDataFromRedis } = proxyquire(
    '../../src/queue/redis-data-handle.js',
    {
        '../bot/actions': {
            createRoom: createRoomStub,
        },
    },
);

const getParsedAndSaveToRedis = proxyquire('../../src/jira-hook-parser', {
    './is-ignore': stub(),
});

const { expect } = chai;
chai.use(sinonChai);

describe('Queue handler test', () => {
    const { sourceIssueId } = deletedLinkBody.issueLink;
    const { destinationIssueId } = deletedLinkBody.issueLink;

    const chatApi = {
        sendHtmlMessage: stub(),
        getRoomId: stub(),
    };
    beforeEach(() => {
        nock(jiraUrl)
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
        await getParsedAndSaveToRedis(JSONbody);
        const roomsKeys = await getRedisRooms();
        expect(roomsKeys)
            .to.be.an('array')
            .that.has.length(1);

        createRoomStub.throws('Incorrect room data');
        await handleRedisRooms(chatApi, roomsKeys);
        const newRoomsKeys = await getRedisRooms();

        expect(newRoomsKeys)
            .to.be.an('array')
            .that.has.length(1);
        expect(newRoomsKeys).to.deep.equal(roomsKeys);
    });

    it('Expect deleteLink to be handled', async () => {
        await getParsedAndSaveToRedis(deletedLinkBody);
        const data = await getDataFromRedis();
        await handleRedisData(chatApi, data);

        const resKeys = await getDataFromRedis();
        expect(resKeys).to.be.null;
    });
});
