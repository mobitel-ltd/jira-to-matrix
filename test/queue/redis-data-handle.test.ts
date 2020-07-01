import { stub, createStubInstance, match } from 'sinon';
import sinonChai from 'sinon-chai';
import * as chai from 'chai';
import * as path from 'path';
import * as tmp from 'tmp-promise';
import { info } from '../fixtures/archiveRoom/raw-events-data';
import nock from 'nock';
import { config } from '../../src/config';
import { cleanRedis, getChatClass, startGitServer, setRepo, baseMedia, taskTracker } from '../test-utils';
import { setArchiveProject } from '../../src/bot/settings';
import JSONbody from '../fixtures/webhooks/issue/created.json';
import issueJson from '../fixtures/jira-api-requests/issue.json';
import issueBody from '../fixtures/jira-api-requests/issue-rendered.json';
import searchProject from '../fixtures/jira-api-requests/project-gens/search-project.json';
import { StateEnum } from '../../src/bot/actions/archive-project';
import { redis, ARCHIVE_PROJECT } from '../../src/redis-client';
import { Jira } from '../../src/task-trackers/jira';
import { QueueHandler } from '../../src/queue';
import { HookParser } from '../../src/hook-parser';
import { Config, ActionNames } from '../../src/types';
import { NO_ROOM_PATTERN, END_NO_ROOM_PATTERN } from '../../src/lib/consts';
import { Actions } from '../../src/bot/actions';

const { expect } = chai;
chai.use(sinonChai);

const createRoomStub = stub();

describe('saveIncoming', () => {
    const actions = createStubInstance(Actions);
    const queueHandler = new QueueHandler(taskTracker, config, (actions as unknown) as Actions);

    it('test saveIncoming with no createRoomData args', async () => {
        await queueHandler.saveIncoming({ redisKey: 'newrooms' });
        const result = await queueHandler.getRedisRooms();

        expect(result).to.be.null;
    });
});

describe('redis-data-handle test', () => {
    const actions = createStubInstance(Actions);
    const queueHandler = new QueueHandler(taskTracker, config, (actions as unknown) as Actions);

    const createRoomData = [
        {
            issue: {
                key: 'BBCOM-1111',
                id: '30369',
                roomMembers: ['jira_test'],
                summary: 'Test',
                descriptionFields: {
                    assigneeName: 'jira_test',
                    reporterName: 'jira_test',
                    typeName: 'Task',
                    epicLink: 'BBCOM-801',
                    estimateTime: '1h',
                    description: 'Info',
                    priority: 'Medium',
                },
            },
        },
    ];
    const redisKey = 'postEpicUpdates_2018-1-11 13:08:04,225';

    const expectedFuncKeys = [`${config.redis.prefix}${redisKey}`];
    // const expectedFuncKeys = ['test-jira-hooks:postEpicUpdates_2018-1-11 13:08:04,225'];

    const expectedData = [
        {
            redisKey,
            funcName: 'postEpicUpdates',
            data: {
                epicKey: 'BBCOM-801',
                data: {
                    key: JSONbody.issue.key,
                    summary: JSONbody.issue.fields.summary,
                    id: '30369',
                    name: 'jira_test',
                },
            },
        },
    ];

    const expectedRoom = [
        {
            issue: {
                key: JSONbody.issue.key,
                id: '30369',
                summary: JSONbody.issue.fields.summary,
                descriptionFields: {
                    assigneeName: JSONbody.issue.fields.assignee.displayName,
                    reporterName: JSONbody.issue.fields.reporter.displayName,
                    typeName: 'Task',
                    epicLink: 'BBCOM-801',
                    estimateTime: '1h',
                    description: 'Info',
                    priority: 'Medium',
                },
                projectKey: 'BBCOM',
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

    beforeEach(() => {
        const [endpoint, ...restBase] = config.taskTracker.url.split('/').reverse();
        const baseUrl = restBase.reverse().join('/');
        nock(baseUrl)
            .get('/' + endpoint)
            .times(2)
            .reply(200, '<HTML>');

        nock(taskTracker.getRestUrl())
            .get(`/issue/${JSONbody.issue.key}`)
            .times(3)
            .reply(200, issueJson)
            .get(`/issue/BBCOM-1398/watchers`)
            .reply(200, { ...responce, id: 28516 })
            .get(`/issue/30369`)
            .query(Jira.expandParams)
            .reply(200, issueBody)
            .get(`/issue/BBCOM-801`)
            .query(Jira.expandParams)
            .reply(200, issueBody)
            .get(url => url.indexOf('null') > 0)
            .reply(404);
    });

    it('test null handleRedisRooms', async () => {
        await queueHandler.handleRedisRooms(null);
        expect(createRoomStub).not.to.be.called;
    });

    describe('Test mode ON', () => {
        const configWithActiveTestMode: Config = { ...config, testMode: { ...config.testMode, on: true } };
        const hookParser = new HookParser(taskTracker, configWithActiveTestMode, queueHandler);

        beforeEach(async () => {
            const notIgnoreCreatorHook = JSONbody;

            await hookParser.getParsedAndSaveToRedis(notIgnoreCreatorHook);
        });

        it('Expect hook to be ignore and both redisKeys and redisData to be empty if hook issue creator is not in the list of config ignore users', async () => {
            const redisKeys = await queueHandler.getRedisKeys();
            const dataFromRedis = await queueHandler.getDataFromRedis();

            expect(redisKeys).to.be.empty;
            expect(dataFromRedis).to.be.null;
        });
    });

    describe('Test mode OFF', () => {
        const configProdMode: Config = { ...config, testMode: { ...config.testMode, on: false } };
        const hookParser = new HookParser(taskTracker, configProdMode, queueHandler);

        beforeEach(async () => {
            const notIgnoreCreatorHook = JSONbody;

            await hookParser.getParsedAndSaveToRedis(notIgnoreCreatorHook);
        });

        it('test correct not saving the same hook', async () => {
            nock(taskTracker.getRestUrl())
                .get(`/issue/${JSONbody.issue.key}`)
                .times(2)
                .reply(200, issueJson)
                .get(`/issue/BBCOM-1398/watchers`)
                .reply(200, { ...responce, id: 28516 })
                .get(`/issue/30369`)
                .query(Jira.expandParams)
                .reply(200, issueBody)
                .get(`/issue/BBCOM-801`)
                .query(Jira.expandParams)
                .reply(200, issueBody)
                .get(url => url.indexOf('null') > 0)
                .reply(404);

            await hookParser.getParsedAndSaveToRedis(JSONbody);

            const redisKeys = await queueHandler.getRedisKeys();
            expect(redisKeys).be.deep.eq(expectedFuncKeys);
            const redisHandled = await queueHandler.getHandledKeys();
            expect(redisHandled).be.deep.eq([redisKey]);
        });

        it('Expect hook NOT to be ignore and both redisKeys and redisData to exist if hook issue creator is not in the list of config ignore users', async () => {
            const redisKeys = await queueHandler.getRedisKeys();
            const dataFromRedis = await queueHandler.getDataFromRedis();

            expect(redisKeys).not.to.be.empty;
            expect(dataFromRedis).not.to.be.null;
        });

        it('test correct handleRedisData', async () => {
            const dataFromRedisBefore = await queueHandler.getDataFromRedis();
            await queueHandler.handleRedisData(dataFromRedisBefore);
            const dataFromRedisAfter = await queueHandler.getDataFromRedis();

            expect(dataFromRedisBefore).to.have.deep.members(expectedData);
            expect(dataFromRedisAfter).to.be.null;
            expect(actions.run).to.be.calledWith('postEpicUpdates');
        });

        it('test error in key handleRedisData', async () => {
            nock.cleanAll();
            nock(taskTracker.getRestUrl())
                .get(`/issue/${JSONbody.issue.key}`)
                .times(3)
                .reply(200, issueJson);

            actions.run
                .withArgs(ActionNames.PostEpicUpdates, match.any) // https://stackoverflow.com/a/26724459/11147137
                .throws(`${NO_ROOM_PATTERN}${JSONbody.issue.key}${END_NO_ROOM_PATTERN}`);

            const dataFromRedisBefore = await queueHandler.getDataFromRedis();
            await queueHandler.handleRedisData(dataFromRedisBefore);
            const dataFromRedisAfter = await queueHandler.getDataFromRedis();
            const redisRooms = await queueHandler.getRedisRooms();

            expect(dataFromRedisBefore).to.have.deep.members(expectedData);
            expect(dataFromRedisAfter).to.have.deep.members(expectedData);
            expect(redisRooms).deep.eq([{ issue: { key: JSONbody.issue.key } }]);
            expect(actions.run).to.be.calledWith(ActionNames.PostEpicUpdates);
        });

        it('test error in key handleRedisData if issue is not exists', async () => {
            actions.run
                .withArgs(ActionNames.PostEpicUpdates, match.any)
                .throws(`${NO_ROOM_PATTERN}${JSONbody.issue.key}${END_NO_ROOM_PATTERN}`);

            const dataFromRedisBefore = await queueHandler.getDataFromRedis();
            const redisRoomsBefore = await queueHandler.getRedisRooms();
            await queueHandler.handleRedisData(dataFromRedisBefore);
            const dataFromRedisAfter = await queueHandler.getDataFromRedis();
            const redisRooms = await queueHandler.getRedisRooms();

            expect(dataFromRedisBefore).to.have.deep.members(expectedData);
            expect(dataFromRedisAfter).to.be.null;
            expect(redisRooms).deep.eq(redisRoomsBefore);
            expect(actions.run).to.be.calledWith(ActionNames.PostEpicUpdates);
        });

        it('test correct roomsData', async () => {
            const roomsData = await queueHandler.getRedisRooms();
            expect(roomsData).to.have.deep.members(expectedRoom);
        });

        it('test handleRedisRooms with error', async () => {
            await queueHandler.saveIncoming({ redisKey: 'newrooms', createRoomData });
            actions.run.callsFake((el, data) => {
                if (data.issue.key === 'BBCOM-1111') {
                    return Promise.reject('Error');
                }

                return Promise.resolve(true);
            });
            const roomsData = await queueHandler.getRedisRooms();
            expect(roomsData).to.have.deep.equal([...expectedRoom, ...createRoomData]);
            await queueHandler.handleRedisRooms(roomsData);

            const roomsKeysAfter = await queueHandler.getRedisRooms();
            expect(roomsKeysAfter).to.have.deep.equal(createRoomData);
        });

        it('test correct handleRedisRooms', async () => {
            const roomsKeysBefore = await queueHandler.getRedisRooms();
            await queueHandler.handleRedisRooms(roomsKeysBefore);
            expect(actions.run).to.be.calledWith(ActionNames.CreateRoom);
            const roomsKeysAfter = await queueHandler.getRedisRooms();
            expect(roomsKeysAfter).to.be.null;
        });
    });

    afterEach(async () => {
        nock.cleanAll();
        createRoomStub.reset();
        await cleanRedis();
    });
});

describe('handle queue for only new task newrooms', () => {
    const actions = createStubInstance(Actions);
    const queueHandler = new QueueHandler(taskTracker, config, (actions as unknown) as Actions);

    it('test createRoomDataOnlyNew shoul be return array only new tasks', () => {
        const createRoomDataBase = taskTracker.parser.getCreateRoomData(JSONbody);
        const createRoomDataIssueKeyOnly = { issue: { key: createRoomDataBase.issue.key } };
        const createRoomDataIssueProjectOnly = { projectKey: createRoomDataBase.projectKey };

        const createRoomDataBase2 = taskTracker.parser.getCreateRoomData(JSONbody);
        createRoomDataBase2.issue.key = 'another';

        const result = queueHandler.createRoomDataOnlyNew([
            createRoomDataBase,
            createRoomDataIssueProjectOnly,
            createRoomDataIssueKeyOnly,
            createRoomDataBase2,
        ]);
        expect(result).to.be.deep.equal([
            createRoomDataIssueKeyOnly,
            createRoomDataIssueProjectOnly,
            createRoomDataBase2,
        ]);
    });
});

describe('Test handle archive project data', () => {
    const lastKey = searchProject.issues[0].key;
    const expectedIssueCount = Number(lastKey.split('-')[1]);
    let chatApi;
    let chatSingle;
    const projectKey = 'INDEV';

    const laterProject = 'OROR';
    const laterProjectKey = `${laterProject}-${expectedIssueCount - 1}`;
    const notFoundId = 'lalalal';
    const aliasExists = `${projectKey}-${expectedIssueCount - 1}`;
    const aliasRemoved = `${projectKey}-${expectedIssueCount - 2}`;
    const otherCreator = `${projectKey}-${expectedIssueCount - 3}`;

    beforeEach(() => {
        const chatClass = getChatClass({
            alias: [lastKey, aliasExists, laterProjectKey, aliasRemoved, otherCreator, laterProjectKey],
            roomId: [lastKey, aliasExists, laterProjectKey],
        });
        chatSingle = chatClass.chatApiSingle;
        chatApi = chatClass.chatApi;
    });

    afterEach(async () => {
        nock.cleanAll();
        await cleanRedis();
    });

    describe('Base operations', () => {
        const actions: Actions = ({ run: stub() } as unknown) as Actions;
        const queueHandler: QueueHandler = new QueueHandler(taskTracker, config, actions);

        it('Expect nothing handles if redis key is empty', async () => {
            const keys = await queueHandler.getCommandKeys();
            const res = await queueHandler.handleCommandKeys(keys);
            expect(res).to.be.empty;
        });

        it('expect setArchiveProject work correct', async () => {
            await setArchiveProject(projectKey);
            const [data] = await redis.getList(ARCHIVE_PROJECT);
            expect(data).to.include(projectKey);
        });
    });

    describe('With exists key', () => {
        let gitServer;
        let tmpDir: tmp.DirectoryResult;
        let configWithTmpPath: Config;
        let queueHandler: QueueHandler;

        const expectedRemote = `${config.baseRemote}/${projectKey.toLowerCase()}.git`;

        beforeEach(async () => {
            nock(taskTracker.getRestUrl())
                .get(`/issue/${lastKey}`)
                .reply(200, issueBody)
                .get(`/search?jql=project=${projectKey}`)
                .reply(200, searchProject)
                .get(`/search?jql=project=${laterProject}`)
                .reply(200, searchProject);

            nock(baseMedia)
                .get(`/${info.mediaId}`)
                .times(2)
                .replyWithFile(200, path.resolve(__dirname, '../fixtures/archiveRoom/media.jpg'))
                .get(`/${info.blobId}`)
                .times(2)
                .replyWithFile(200, path.resolve(__dirname, '../fixtures/archiveRoom/media.jpg'))
                .get(`/${info.avatarId}`)
                .times(2)
                .replyWithFile(200, path.resolve(__dirname, '../fixtures/archiveRoom/media.jpg'));

            const keepTimestamp = Date.now();
            // all data is later than now
            await setArchiveProject(projectKey, { keepTimestamp, status: issueJson.fields.status.name });
            // all data is earlier than now
            await setArchiveProject(laterProject, { keepTimestamp: info.maxTs - 5 });
            tmpDir = await tmp.dir({ unsafeCleanup: true });
            configWithTmpPath = { ...config, gitReposPath: tmpDir.path };
            const actions = new Actions(configWithTmpPath, taskTracker, chatApi);
            queueHandler = new QueueHandler(taskTracker, configWithTmpPath, actions);
            gitServer = startGitServer(path.resolve(tmpDir.path, 'git-server'));
            const pathToExistFixtures = path.resolve(__dirname, '../fixtures/archiveRoom/already-exisits-git');
            await setRepo(tmpDir.path, expectedRemote, { pathToExistFixtures, roomName: lastKey });
        });

        afterEach(() => {
            gitServer.close();
            tmpDir.cleanup();
        });

        it('Expect all data is handled', async () => {
            chatSingle.getRoomIdByName
                .withArgs(otherCreator)
                .resolves(notFoundId)
                .withArgs(aliasRemoved)
                .resolves(notFoundId);
            chatSingle.isInRoom.withArgs(notFoundId).resolves(false);
            chatSingle.deleteRoomAlias.withArgs(aliasRemoved).resolves('ok');

            const keys = await queueHandler.getCommandKeys();
            // set order
            const { [projectKey]: res1, [laterProject]: res2 } = (await queueHandler.handleCommandKeys(keys))!;

            expect(res2[StateEnum.NOT_FOUND]).to.have.length(5);
            // expect(res2[StateEnum.STILL_ACTIVE]).to.have.length(1);
            expect(res2[StateEnum.STILL_ACTIVE]).to.have.length(1);

            expect(res1[StateEnum.NOT_FOUND]).to.have.length(2);
            expect(res1[StateEnum.ARCHIVED]).to.have.length(2);
            expect(res1[StateEnum.ALIAS_REMOVED]).to.have.length(1);
            expect(res1[StateEnum.ERROR_ARCHIVING]).to.have.length(0);
            expect(res1[StateEnum.OTHER_ALIAS_CREATOR]).to.have.length(1);
            expect(res1[StateEnum.STILL_ACTIVE]).to.have.length(0);
        });
    });
});
