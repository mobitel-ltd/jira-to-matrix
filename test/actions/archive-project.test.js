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
const { cleanRedis, getChatApi, startGitServer, setRepo, baseMedia, getRoomId } = require('../test-utils');
const rawEventsData = require('../fixtures/archiveRoom/raw-events');
const proxyquire = require('proxyquire');
const gitPullToRepoStub = stub();
const {
    getLastMessageTimestamp,
    handleKnownRoom,
    FORBIDDEN_EVENTS,
    MOVED,
    STILL_ACTIVE,
    ARCHIVED,
    ALIAS_REMOVED,
    ERROR_ARCHIVING,
    OTHER_ALIAS_CREATOR,
} = proxyquire('../../src/bot/actions/archive-project', {
    '../timeline-handler/commands/archive': {
        gitPullToRepo: gitPullToRepoStub,
    },
});
const expected = require('../fixtures/archiveRoom/raw-events-data');
const { gitPullToRepo } = require('../../src/bot/timeline-handler/commands/archive');

describe('Test handle archive project data', () => {
    let server;
    let tmpDir;
    let chatApi;
    let messengerApi;
    const projectKey = 'INDEV';
    const alias = `${projectKey}-${123}`;
    const roomId = getRoomId();

    // const notFoundId = 'lalalal';
    const expectedRemote = `${baseRemote}/${projectKey.toLowerCase()}.git`;

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
        server = startGitServer(path.resolve(tmpDir.path, 'git-server'));
        const pathToExistFixtures = path.resolve(__dirname, '../fixtures/archiveRoom/already-exisits-git');
        await setRepo(tmpDir.path, expectedRemote, { pathToExistFixtures, roomName: alias });
        gitPullToRepoStub.callsFake(gitPullToRepo);
    });

    afterEach(async () => {
        server.close();
        tmpDir.cleanup();
        nock.cleanAll();
        await cleanRedis();
    });

    it('Expect return ARCHIVED if all is ok', async () => {
        const res = await handleKnownRoom(chatApi, Date.now(), roomId, alias);

        expect(res).to.eq(ARCHIVED);
        expect(messengerApi.kickUserByRoom).to.be.called;
        expect(messengerApi.deleteRoomAlias).to.be.called;
        expect(messengerApi.leaveRoom).to.be.called;
    });

    it('Expect return MOVED if alias in room data not equals using alias', async () => {
        messengerApi.getRoomDataById.reset();
        messengerApi.getRoomDataById.resolves({ alias: 'some-other-name' });
        const res = await handleKnownRoom(chatApi, Date.now(), roomId, alias);

        expect(res).to.eq(MOVED);
        expect(messengerApi.kickUserByRoom).not.to.be.called;
        expect(messengerApi.deleteRoomAlias).to.be.called;
        expect(messengerApi.leaveRoom).not.to.called;
    });

    it('Expect FORBIDDEN_EVENTS if git request return false, kick and alias is not calls', async () => {
        messengerApi.getAllEventsFromRoom.resolves(false);
        const res = await handleKnownRoom(chatApi, Date.now(), roomId, alias);

        expect(res).to.eq(FORBIDDEN_EVENTS);
        expect(messengerApi.kickUserByRoom).not.to.called;
        expect(messengerApi.deleteRoomAlias).not.to.called;
        expect(messengerApi.leaveRoom).not.to.called;
    });

    it('Expect ERROR_ARCHIVING if git request return false, kick and alias is not calls', async () => {
        gitPullToRepoStub.resolves(false);
        const res = await handleKnownRoom(chatApi, Date.now(), roomId, alias);

        expect(res).to.eq(ERROR_ARCHIVING);
        expect(messengerApi.kickUserByRoom).not.to.called;
        expect(messengerApi.deleteRoomAlias).not.to.called;
        expect(messengerApi.leaveRoom).not.to.called;
    });

    it('Expect STILL_ACTIVE returns and no kick, delete alias and leave is called if timestamp is less than keep time', async () => {
        const res = await handleKnownRoom(chatApi, expected.maxTs - 10, roomId, alias);

        expect(res).to.eq(STILL_ACTIVE);
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
            const res = await handleKnownRoom(chatApi, Date.now(), roomId, alias);

            expect(res).to.eq(ALIAS_REMOVED);
            expect(messengerApi.kickUserByRoom).not.to.called;
            expect(messengerApi.deleteRoomAlias).to.be.called;
            expect(messengerApi.leaveRoom).not.to.called;
        });

        it('Expect return OTHER_ALIAS_CREATOR if not exist alias creator in bot list', async () => {
            const res = await handleKnownRoom(chatApi, Date.now(), roomId, alias);

            expect(res).to.eq(OTHER_ALIAS_CREATOR);
            expect(messengerApi.kickUserByRoom).not.to.called;
            expect(messengerApi.deleteRoomAlias).to.be.called;
            expect(messengerApi.leaveRoom).not.to.called;
        });
    });
});

describe('Archive project', () => {
    it('Expect getLastMessageTimestamp return last message timestamp', () => {
        const res = getLastMessageTimestamp(rawEventsData);
        expect(res).to.eq(expected.maxTs);
    });
});
