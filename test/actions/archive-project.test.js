const ChatFasade = require('../../src/messengers/chat-fasade');
const path = require('path');
const tmp = require('tmp-promise');
const nock = require('nock');
const { baseRemote } = require('../../src/config');
// const projectBody = require('../fixtures/jira-api-requests/project.json');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const { expect } = chai;
const { stub } = require('sinon');
chai.use(sinonChai);
const { cleanRedis, getChatApi, startGitServer, setRepo, baseMedia } = require('../test-utils');
const rawEvents = require('../fixtures/archiveRoom/raw-events');
const proxyquire = require('proxyquire');
const gitPullToRepoStub = stub();
const { getLastMessageTimestamp, stateEnum } = require('../../src/bot/actions/archive-project');
const { getRoomArchiveState } = proxyquire('../../src/bot/actions/archive-project', {
    '../../lib/git-lib': {
        exportEvents: gitPullToRepoStub,
    },
});
const rawEventsData = require('../fixtures/archiveRoom/raw-events-data');
const { exportEvents } = require('../../src/lib/git-lib');
const utils = require('../../src/lib/utils.js');
const issueJSON = require('../fixtures/jira-api-requests/issue.json');
const config = require('../../src/config');

describe('Test handle archive project data', () => {
    let server;
    let tmpDir;
    let chatApi;
    let messengerApi;
    const projectKey = 'INDEV';
    const alias = `${projectKey}-${123}`;
    let configWithTmpPath;

    // const notFoundId = 'lalalal';
    const expectedRemote = `${baseRemote}/${projectKey.toLowerCase()}.git`;
    let options;

    beforeEach(async () => {
        messengerApi = getChatApi({ alias });
        chatApi = new ChatFasade([messengerApi]);

        nock(baseMedia)
            .get(`/${rawEventsData.mediaId}`)
            .replyWithFile(200, path.resolve(__dirname, '../fixtures/archiveRoom/media.jpg'))
            .get(`/${rawEventsData.blobId}`)
            .replyWithFile(200, path.resolve(__dirname, '../fixtures/archiveRoom/media.jpg'))
            .get(`/${rawEventsData.avatarId}`)
            .replyWithFile(200, path.resolve(__dirname, '../fixtures/archiveRoom/media.jpg'));

        // all data is later than now
        tmpDir = await tmp.dir({ unsafeCleanup: true });
        configWithTmpPath = { ...config, gitReposPath: tmpDir.path };
        server = startGitServer(path.resolve(tmpDir.path, 'git-server'));
        const pathToExistFixtures = path.resolve(__dirname, '../fixtures/archiveRoom/already-exisits-git');
        await setRepo(tmpDir.path, expectedRemote, { pathToExistFixtures, roomName: alias });
        gitPullToRepoStub.callsFake(exportEvents);
        options = { projectKey, alias, keepTimestamp: Date.now(), config: configWithTmpPath };
    });

    afterEach(async () => {
        server.close();
        tmpDir.cleanup();
        nock.cleanAll();
        await cleanRedis();
    });

    it('Expect return ARCHIVED if all is ok', async () => {
        const res = await getRoomArchiveState(chatApi, options);

        expect(res).to.eq(stateEnum.ARCHIVED);
        expect(messengerApi.kickUserByRoom).to.be.called;
        expect(messengerApi.deleteRoomAlias).to.be.called;
        expect(messengerApi.leaveRoom).to.be.called;
    });

    it('Expect return ROOM_NOT_RETURN_ALIAS if alias in room data is NULL', async () => {
        messengerApi.getRoomDataById.reset();
        messengerApi.getRoomDataById.resolves({ alias: null });
        const res = await getRoomArchiveState(chatApi, options);

        expect(res).to.eq(stateEnum.ROOM_NOT_RETURN_ALIAS);
        expect(messengerApi.kickUserByRoom).not.to.be.called;
        expect(messengerApi.deleteRoomAlias).not.to.be.called;
        expect(messengerApi.leaveRoom).not.to.called;
    });

    it('Expect return MOVED if alias in room data not equals using alias', async () => {
        messengerApi.getRoomDataById.reset();
        messengerApi.getRoomDataById.resolves({ alias: 'some-other-name' });
        const res = await getRoomArchiveState(chatApi, options);

        expect(res).to.eq(stateEnum.MOVED);
        expect(messengerApi.kickUserByRoom).not.to.be.called;
        expect(messengerApi.deleteRoomAlias).to.be.called;
        expect(messengerApi.leaveRoom).not.to.called;
    });

    it('Expect FORBIDDEN_EVENTS if git request return false, kick and alias is not calls', async () => {
        messengerApi.getAllEventsFromRoom.resolves(false);
        const res = await getRoomArchiveState(chatApi, options);

        expect(res).to.eq(stateEnum.FORBIDDEN_EVENTS);
        expect(messengerApi.kickUserByRoom).not.to.called;
        expect(messengerApi.deleteRoomAlias).not.to.called;
        expect(messengerApi.leaveRoom).not.to.called;
    });

    it('Expect ERROR_ARCHIVING if git request return false, kick and alias is not calls', async () => {
        gitPullToRepoStub.resolves(false);
        const res = await getRoomArchiveState(chatApi, options);

        expect(res).to.eq(stateEnum.ERROR_ARCHIVING);
        expect(messengerApi.kickUserByRoom).not.to.called;
        expect(messengerApi.deleteRoomAlias).not.to.called;
        expect(messengerApi.leaveRoom).not.to.called;
    });

    it('Expect STILL_ACTIVE returns and no kick, delete alias and leave is called if timestamp is less than keep time', async () => {
        const res = await getRoomArchiveState(chatApi, { ...options, keepTimestamp: rawEventsData.maxTs - 10 });

        expect(res).to.eq(stateEnum.STILL_ACTIVE);
        expect(messengerApi.kickUserByRoom).not.to.called;
        expect(messengerApi.deleteRoomAlias).not.to.called;
        expect(messengerApi.leaveRoom).not.to.called;
    });

    describe('No bot is room', () => {
        beforeEach(() => {
            messengerApi.isInRoom.resolves(false);
        });

        it('Expect return ALIAS_REMOVED if one of bot alias creator', async () => {
            messengerApi.deleteRoomAlias.withArgs(alias).resolves('ok');
            const res = await getRoomArchiveState(chatApi, options);

            expect(res).to.eq(stateEnum.ALIAS_REMOVED);
            expect(messengerApi.kickUserByRoom).not.to.called;
            expect(messengerApi.deleteRoomAlias).to.be.called;
            expect(messengerApi.leaveRoom).not.to.called;
        });

        it('Expect return OTHER_ALIAS_CREATOR if not exist alias creator in bot list', async () => {
            const res = await getRoomArchiveState(chatApi, options);

            expect(res).to.eq(stateEnum.OTHER_ALIAS_CREATOR);
            expect(messengerApi.kickUserByRoom).not.to.called;
            expect(messengerApi.deleteRoomAlias).to.be.called;
            expect(messengerApi.leaveRoom).not.to.called;
        });
    });

    it('Expect issue is not found and archive wiil be running', async () => {
        const state = await getRoomArchiveState(chatApi, {
            ...options,
            status: 'some other status',
        });

        expect(state).to.eq(stateEnum.ARCHIVED);
        expect(messengerApi.kickUserByRoom).to.be.called;
        expect(messengerApi.deleteRoomAlias).to.be.called;
        expect(messengerApi.leaveRoom).to.be.called;
    });

    describe('Status exists', () => {
        beforeEach(() => {
            nock(utils.getRestUrl())
                .get(`/issue/${alias}`)
                .reply(200, issueJSON);
        });

        it('Expect issue is in another status and archive not run', async () => {
            const state = await getRoomArchiveState(chatApi, { ...options, status: 'some other status' });

            expect(state).to.eq(stateEnum.ANOTHER_STATUS);
            expect(messengerApi.kickUserByRoom).not.to.be.called;
            expect(messengerApi.deleteRoomAlias).not.to.be.called;
            expect(messengerApi.leaveRoom).not.to.be.called;
        });

        it('Expect issue is in correct status and archiving run', async () => {
            const state = await getRoomArchiveState(chatApi, { ...options, status: issueJSON.fields.status.name });

            expect(state).to.eq(stateEnum.ARCHIVED);
            expect(messengerApi.kickUserByRoom).to.be.called;
            expect(messengerApi.deleteRoomAlias).to.be.called;
            expect(messengerApi.leaveRoom).to.be.called;
        });
    });
});

describe('Archive project', () => {
    it('Expect getLastMessageTimestamp return last message timestamp', () => {
        const res = getLastMessageTimestamp(rawEvents);
        expect(res).to.eq(rawEventsData.maxTs);
    });
});
