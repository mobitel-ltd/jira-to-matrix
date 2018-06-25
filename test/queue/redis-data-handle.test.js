const nock = require('nock');
const {auth} = require('../../src/lib/utils.js');
const JSONbody = require('../fixtures/create.json');
const issueBody = require('../fixtures/response.json');
const getParsedAndSaveToRedis = require('../../src/jira-hook-parser');
const {prefix} = require('../fixtures/config.js').redis;
const redis = require('../../src/redis-client.js');
const proxyquire = require('proxyquire');
const chai = require('chai');
const {stub, spy} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);
const logger = require('../../src/modules/log.js')(module);

const createRoomStub = stub();
const postEpicUpdatesStub = stub();
const loggerSpy = {
    error: spy(),
    warn: spy(),
    debug: spy(),
    info: spy(),
};

const {
    saveIncoming,
    getRedisKeys,
    getDataFromRedis,
    getRedisRooms,
    handleRedisData,
    handleRedisRooms,
} = proxyquire('../../src/queue/redis-data-handle.js', {
    '../bot': {
        createRoom: createRoomStub,
        postEpicUpdates: postEpicUpdatesStub,
    },
    '../modules/log.js': () => loggerSpy,
});

describe('saveIncoming', function() {
    it('test saveIncoming with no createRoomData args', async () => {
        await saveIncoming({redisKey: 'newrooms'});
        const result = await getRedisRooms();
        expect(result).to.be.null;
    });
});

describe('redis-data-handle', function() {
    const expectedFuncKeys = [
        "test-jira-hooks:postEpicUpdates_2018-1-11 13:08:04,225",
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
                    status: null
                },
            }
        },
];

    const expectedRoom = [
        {
            issue: {
                key: 'BBCOM-1398',
                id: '30369',
                collectParticipantsBody: ['jira_test', 'jira_test', 'jira_test'],
                url: 'https://jira.bingo-boom.ru/jira/rest/api/2/issue/BBCOM-1398/watchers',
                summary: 'Test',
                descriptionFields: {
                    assigneeName: 'jira_test',
                    assigneeEmail: 'jira_test@bingo-boom.ru',
                    reporterName: 'jira_test',
                    reporterEmail: 'jira_test@bingo-boom.ru',
                    typeName: 'Task',
                    epicLink: 'BBCOM-801',
                    estimateTime: '1h',
                    description: 'Info',
                    priority: 'Medium',
                }
            },
            webhookEvent: 'jira:issue_created'
        }
    ];

    const responce = {
        id: "10002",
        self: "http://www.example.com/jira/rest/api/2/issue/10002",
        key: "EpicKey",
        fields: {
            summary: 'SummaryKey',
        }
    };

    const epicResponse = {
        id: "10002",
        self: "http://www.example.com/jira/rest/api/2/issue/1000122",
        key: "EX-1",
        fields: {
            summary: 'SummaryKey',
        }
    };

    const mclient = {};

    beforeEach(async () => {
        nock('https://jira.bingo-boom.ru', {reqheaders: {Authorization: auth()}})
            .get('/jira/rest/api/2/issue/BBCOM-1398/watchers')
            .reply(200, {...responce, id: 28516})
            .get(`/jira/rest/api/2/issue/30369?expand=renderedFields`)
            .reply(200, issueBody)
            .get(`/jira/rest/api/2/issue/BBCOM-801?expand=renderedFields`)
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
        postEpicUpdatesStub.callsFake(() => ({}));
        loggerSpy.info.reset();

        const dataFromRedisBefore = await getDataFromRedis();
        await handleRedisData('client', dataFromRedisBefore);
        const dataFromRedisAfter = await getDataFromRedis();
        const expected = 'Result of handling redis key';

        expect(dataFromRedisBefore).to.have.deep.members(expectedData);
        expect(loggerSpy.info).to.have.been.calledWith(expected);
        expect(dataFromRedisAfter).to.be.null;
        expect(postEpicUpdatesStub).to.be.called;
    });

    it('test error in key handleRedisData', async () => {
        postEpicUpdatesStub.throws('error');
        loggerSpy.error.reset();

        const dataFromRedisBefore = await getDataFromRedis();
        await handleRedisData('client', dataFromRedisBefore);
        const dataFromRedisAfter = await getDataFromRedis();
        const expected = 'Error in postEpicUpdates_2018-1-11 13:08:04,225\n';

        expect(dataFromRedisBefore).to.have.deep.members(expectedData);
        expect(loggerSpy.error).to.have.been.calledWith(expected);
        expect(dataFromRedisAfter).to.have.deep.members(expectedData);
        expect(postEpicUpdatesStub).to.be.called;
    });

    it('test correct roomsData', async () => {
        const roomsData = await getRedisRooms();
        expect(roomsData).to.have.deep.members(expectedRoom);
    });

    it('test handleRedisRooms with error', async () => {
        const createRoomData = [{
            issue: {
                key: 'BBCOM-1111',
                id: '30369',
                collectParticipantsBody: ['jira_test', 'jira_test', 'jira_test'],
                url: 'https://jira.bingo-boom.ru/jira/rest/api/2/issue/BBCOM-1398/watchers',
                summary: 'Test',
                descriptionFields: {
                    assigneeName: 'jira_test',
                    assigneeEmail: 'jira_test@bingo-boom.ru',
                    reporterName: 'jira_test',
                    reporterEmail: 'jira_test@bingo-boom.ru',
                    typeName: 'Task',
                    epicLink: 'BBCOM-801',
                    estimateTime: '1h',
                    description: 'Info',
                    priority: 'Medium',
                }
            },
            webhookEvent: 'jira:issue_created'
        }];

        await saveIncoming({redisKey: 'newrooms', createRoomData});
        createRoomStub.callsFake((data) => {
            logger.debug('data', data);
            if (data.issue.key === 'BBCOM-1111') {
                logger.debug('should throw');
                throw 'createRoomStub';
            }
        });
        const roomsData = await getRedisRooms();
        expect(roomsData).to.have.deep.equal([...expectedRoom, ...createRoomData]);
        await handleRedisRooms(mclient, roomsData);
        expect(loggerSpy.error).to.have.been.calledWith('Error in handle room data\n', 'createRoomStub');
        expect(loggerSpy.warn).to.have.been.calledWith('Rooms which not created', createRoomData);

        const roomsKeysAfter = await getRedisRooms();
        logger.debug(roomsKeysAfter);
        expect(roomsKeysAfter).to.have.deep.equal(createRoomData);
        createRoomStub.reset();
    });

    it('test correct handleRedisRooms', async () => {
        createRoomStub.callsFake(() => ({}));

        const roomsKeysBefore = await getRedisRooms();
        await handleRedisRooms(mclient, roomsKeysBefore);
        expect(createRoomStub).to.be.called;
        const roomsKeysAfter = await getRedisRooms();
        expect(roomsKeysAfter).to.be.null;
        createRoomStub.reset();
    });

    it('test null handleRedisRooms', async () => {
        createRoomStub.callsFake(() => ({}));
        await handleRedisRooms(mclient, null);
        expect(createRoomStub).not.to.be.called;
        createRoomStub.reset();
    });

    it('test incorrect handleRedisRooms', async () => {
        createRoomStub.callsFake(() => ({}));
        await handleRedisRooms(mclient, 'rooms');
        expect(createRoomStub).not.to.be.called;
        const expected = 'handleRedisRooms error';
        expect(loggerSpy.error).to.have.been.calledWith(expected);
    });

    afterEach(async () => {
        const keys = await redis.keysAsync('*');

        if (keys.length > 0) {
            const parsedKeys = keys.map(key => key.replace(`${prefix}`, ''));
            await redis.delAsync(parsedKeys);
        }
    });
});

describe('Redis errors in redis-data-handle', function() {
    const {
        rewriteRooms: rewrite,
        saveIncoming: save,
        getRedisValue: getValue,
        getDataFromRedis: getRedisData,
        getRedisRooms: getRooms,
        handleRedisData: handleData
    } = proxyquire('../../src/queue/redis-data-handle.js', {
        '../redis-client.js': {
            getAsync: stub().throws('error'),
            keysAsync: stub().throws('error'),
            setAsync: stub().throws('error'),
        },
        '../modules/log.js': () => loggerSpy,
    });

    it('test error getRedisRooms', async () => {
        const result = await getRooms();
        const expected = 'getRedisRooms error';
        expect(result).to.be.null;
        expect(loggerSpy.error).to.have.been.calledWithExactly(expected);
    });

    it('test error handleRedisData', async () => {
        await handleData('client', 'data');
        const expected = 'handleRedisData error';
        expect(loggerSpy.error).to.have.been.calledWith(expected);
    });

    it('test no handleRedisData', async () => {
        await handleData('client');
        const expected = 'No data from redis';
        expect(loggerSpy.warn).to.have.been.calledWithExactly(expected);
    });

    it('test no handleRedisData', async () => {
        const result = await getRedisData();
        const expected = 'getDataFromRedis error';
        expect(result).to.be.null;
        expect(loggerSpy.error).to.have.been.calledWith(expected);
    });

    it('test no getRedisValue', async () => {
        const result = await getValue({});
        const expected = 'Error in getting value of key: [object Object]\n';

        expect(result).to.be.false;
        expect(loggerSpy.error).to.have.been.calledWith(expected);
    });

    it('test no save to redis error', async () => {
        const expected = 'Error while saving to redis:\nerror';
        try {
            await save({});
        } catch (err) {
            expect(err).to.be.equal(expected);
        }
    });

    it('test rewrite rooms error', async () => {
        const expected = 'Error while rewrite rooms in redis:\nerror';
        try {
            await rewrite('');
        } catch (err) {
            expect(err).to.be.equal(expected);
        }
    });
});
