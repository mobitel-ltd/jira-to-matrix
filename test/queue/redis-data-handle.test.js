const utils = require('../../src/lib/utils');
const nock = require('nock');
const {jira: {url: jiraUrl}} = require('../../src/config');
const {getRestUrl, expandParams} = require('../../src/lib/utils.js');
const {getCreateRoomData} = require('../../src/jira-hook-parser/parse-body.js');
const JSONbody = require('../fixtures/webhooks/issue/created.json');
const projectBody = require('../fixtures/jira-api-requests/project.json');
const issueBody = require('../fixtures/jira-api-requests/issue-rendered.json');
const getParsedAndSaveToRedis = require('../../src/jira-hook-parser');
const proxyquire = require('proxyquire');
const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);
const logger = require('../../src/modules/log.js')(module);
const {cleanRedis} = require('../test-utils');

const createRoomStub = stub();
const postEpicUpdatesStub = stub();

const {
    saveIncoming,
    getRedisKeys,
    getDataFromRedis,
    getRedisRooms,
    handleRedisData,
    handleRedisRooms,
    createRoomDataOnlyNew,
} = proxyquire('../../src/queue/redis-data-handle.js', {
    '../bot/actions': {
        createRoom: createRoomStub,
        postEpicUpdates: postEpicUpdatesStub,
    },
});

describe('saveIncoming', () => {
    it('test saveIncoming with no createRoomData args', async () => {
        await saveIncoming({redisKey: 'newrooms'});
        const result = await getRedisRooms();
        expect(result).to.be.null;
    });
});

describe('redis-data-handle test', () => {
    const createRoomData = [{
        issue: {
            key: 'BBCOM-1111',
            id: '30369',
            roomMembers: ['jira_test'],
            summary: 'Test',
            descriptionFields: {
                assigneeName: 'jira_test',
                assigneeEmail: 'jira_test@test-example.ru',
                reporterName: 'jira_test',
                reporterEmail: 'jira_test@test-example.ru',
                typeName: 'Task',
                epicLink: 'BBCOM-801',
                estimateTime: '1h',
                description: 'Info',
                priority: 'Medium',
            },
        },
    }];

    const expectedFuncKeys = [
        'test-jira-hooks:postEpicUpdates_2018-1-11 13:08:04,225',
    ];

    const expectedData = [
        {
            redisKey: 'postEpicUpdates_2018-1-11 13:08:04,225',
            funcName: 'postEpicUpdates',
            data: {
                epicKey: 'BBCOM-801',
                data: {
                    key: 'BBCOM-1398',
                    summary: 'Test',
                    id: '30369',
                    name: 'jira_test',
                },
            },
        },
    ];

    const expectedRoom = [
        {
            issue: {
                key: 'BBCOM-1398',
                id: '30369',
                summary: 'Test',
                descriptionFields: {
                    assigneeName: JSONbody.issue.fields.assignee.displayName,
                    assigneeEmail: JSONbody.issue.fields.assignee.emailAddress,
                    reporterName: JSONbody.issue.fields.reporter.displayName,
                    reporterEmail: JSONbody.issue.fields.reporter.emailAddress,
                    typeName: 'Task',
                    epicLink: 'BBCOM-801',
                    estimateTime: '1h',
                    description: 'Info',
                    priority: 'Medium',
                },
            },
            projectKey: 'BBCOM',
        },
    ];

    const responce = {
        id: '10002',
        self: 'http://www.example.com/jira/rest/api/2/issue/10002',
        key: 'EpicKey',
        fields: {
            summary: 'SummaryKey',
        },
    };

    // eslint-disable-next-line
    const epicResponse = {
        id: '10002',
        self: 'http://www.example.com/jira/rest/api/2/issue/1000122',
        key: 'EX-1',
        fields: {
            summary: 'SummaryKey',
        },
    };

    const chatApi = {};

    beforeEach(async () => {
        nock(jiraUrl)
            .get('')
            .times(2)
            .reply(200, '<HTML>');

        nock(getRestUrl())
            .get(`/issue/${JSONbody.issue.key}`)
            .reply(200, projectBody)
            .get(`/issue/BBCOM-1398/watchers`)
            .reply(200, {...responce, id: 28516})
            .get(`/issue/30369`)
            .query(expandParams)
            .reply(200, issueBody)
            .get(`/issue/BBCOM-801`)
            .query(expandParams)
            .reply(200, issueBody)
            .get(url => url.indexOf('null') > 0)
            .reply(404);

        await getParsedAndSaveToRedis(JSONbody);
    });


    it('test correct redisKeys', async () => {
        const redisKeys = await getRedisKeys();
        expect(redisKeys).to.have.all.members(expectedFuncKeys);
    });

    it('test correct dataFromRedis', async () => {
        const dataFromRedis = await getDataFromRedis();
        expect(dataFromRedis).to.have.deep.members(expectedData);
    });

    it('test correct handleRedisData', async () => {
        const dataFromRedisBefore = await getDataFromRedis();
        await handleRedisData('client', dataFromRedisBefore);
        const dataFromRedisAfter = await getDataFromRedis();

        expect(dataFromRedisBefore).to.have.deep.members(expectedData);
        expect(dataFromRedisAfter).to.be.null;
        expect(postEpicUpdatesStub).to.be.called;
    });

    it('test error in key handleRedisData', async () => {
        postEpicUpdatesStub.throws(`${utils.NO_ROOM_PATTERN}${JSONbody.issue.key}${utils.END_NO_ROOM_PATTERN}`);

        const dataFromRedisBefore = await getDataFromRedis();
        await handleRedisData('client', dataFromRedisBefore);
        const dataFromRedisAfter = await getDataFromRedis();
        const redisRooms = await getRedisRooms();

        expect(dataFromRedisBefore).to.have.deep.members(expectedData);
        expect(dataFromRedisAfter).to.have.deep.members(expectedData);
        expect(redisRooms).deep.eq([{issue: {key: JSONbody.issue.key}}]);
        expect(postEpicUpdatesStub).to.be.called;
    });

    it('test correct roomsData', async () => {
        const roomsData = await getRedisRooms();
        expect(roomsData).to.have.deep.members(expectedRoom);
    });

    it('test handleRedisRooms with error', async () => {
        await saveIncoming({redisKey: 'newrooms', createRoomData});
        createRoomStub.callsFake(data => {
            logger.debug('data', data);
            if (data.issue.key === 'BBCOM-1111') {
                throw 'createRoomStub';
            }
        });
        const roomsData = await getRedisRooms();
        expect(roomsData).to.have.deep.equal([...expectedRoom, ...createRoomData]);
        await handleRedisRooms(chatApi, roomsData);

        const roomsKeysAfter = await getRedisRooms();
        expect(roomsKeysAfter).to.have.deep.equal(createRoomData);
    });

    it('test correct handleRedisRooms', async () => {
        const roomsKeysBefore = await getRedisRooms();
        await handleRedisRooms(chatApi, roomsKeysBefore);
        expect(createRoomStub).to.be.called;
        const roomsKeysAfter = await getRedisRooms();
        expect(roomsKeysAfter).to.be.null;
    });

    it('test null handleRedisRooms', async () => {
        await handleRedisRooms(chatApi, null);
        expect(createRoomStub).not.to.be.called;
    });

    afterEach(async () => {
        nock.cleanAll();
        createRoomStub.reset();
        await cleanRedis();
    });
});

describe('handle queue for only new task newrooms', () => {
    it('test createRoomDataOnlyNew shoul be return array only new tasks', () => {
        const createRoomDataBase = getCreateRoomData(JSONbody);
        const createRoomDataIssueKeyOnly = {issue: {key: createRoomDataBase.issue.key}};
        const createRoomDataIssueProjectOnly = {projectKey: createRoomDataBase.projectKey};

        const createRoomDataBase2 = getCreateRoomData(JSONbody);
        createRoomDataBase2.issue.key = 'another';
        const createRoomDataBase2changeDescription = {issue: {...createRoomDataBase2.issue, descriptionFields: {...createRoomDataBase2.issue.descriptionFields, description: 'change info'}}, projectKey: createRoomDataBase2.projectKey};

        const result = createRoomDataOnlyNew([
            createRoomDataBase,
            createRoomDataIssueProjectOnly,
            createRoomDataIssueKeyOnly,
            createRoomDataBase2,
            createRoomDataBase2changeDescription,
        ]);
        expect(result).to.be.deep.equal([
            createRoomDataIssueKeyOnly,
            createRoomDataIssueProjectOnly,
            createRoomDataBase2changeDescription,
        ]);
    });
});
