import * as path from 'path';
import { ChatFasade } from '../../src/messengers/chat-fasade';
import * as tmp from 'tmp-promise';
import nock from 'nock';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { stub } from 'sinon';
import { cleanRedis, getChatClass, startGitServer, setRepo, baseMedia } from '../test-utils';
import { rawEvents } from '../fixtures/archiveRoom/raw-events';
import { load } from 'proxyquire';
import { StateEnum, ArchiveProject, ArchiveOptions } from '../../src/bot/actions/archive-project';
import { info } from '../fixtures/archiveRoom/raw-events-data';
import { exportEvents } from '../../src/lib/git-lib';
import issueJSON from '../fixtures/jira-api-requests/issue.json';
import { config } from '../../src/config';
import { getTaskTracker } from '../../src/task-trackers';
import { Jira } from '../../src/task-trackers/jira';

chai.use(sinonChai);

const gitPullToRepoStub = stub();
const moduleData = load('../../src/bot/actions/archive-project', {
    '../../lib/git-lib': {
        exportEvents: gitPullToRepoStub,
    },
});
const ArchiveProject_ = moduleData.ArchiveProject as typeof ArchiveProject;
const { expect } = chai;

describe('Test handle archive project data', () => {
    let server;
    let tmpDir: tmp.DirectoryResult;
    let chatApi;
    let messengerApi;
    const projectKey = 'INDEV';
    const alias = `${projectKey}-${123}`;
    let configWithTmpPath;
    const taskTracker = getTaskTracker(config) as Jira;
    let options: ArchiveOptions;
    let archiveProject: ArchiveProject;

    // const notFoundId = 'lalalal';
    const expectedRemote = `${config.baseRemote}/${projectKey.toLowerCase()}.git`;

    beforeEach(async () => {
        messengerApi = getChatClass({ alias }).chatApiSingle;
        chatApi = new ChatFasade([messengerApi]);

        nock(baseMedia)
            .get(`/${info.mediaId}`)
            .replyWithFile(200, path.resolve(__dirname, '../fixtures/archiveRoom/media.jpg'))
            .get(`/${info.blobId}`)
            .replyWithFile(200, path.resolve(__dirname, '../fixtures/archiveRoom/media.jpg'))
            .get(`/${info.avatarId}`)
            .replyWithFile(200, path.resolve(__dirname, '../fixtures/archiveRoom/media.jpg'));

        // all data is later than now
        tmpDir = await tmp.dir({ unsafeCleanup: true });
        configWithTmpPath = { ...config, gitReposPath: tmpDir.path };
        server = startGitServer(path.resolve(tmpDir.path, 'git-server'));
        const pathToExistFixtures = path.resolve(__dirname, '../fixtures/archiveRoom/already-exisits-git');
        await setRepo(tmpDir.path, expectedRemote, { pathToExistFixtures, roomName: alias });
        gitPullToRepoStub.callsFake(exportEvents);
        options = { keepTimestamp: Date.now(), alias };
        archiveProject = new ArchiveProject_(configWithTmpPath, taskTracker, chatApi);
    });

    afterEach(async () => {
        server.close();
        await tmpDir.cleanup();
        nock.cleanAll();
        await cleanRedis();
    });

    it('Expect return ARCHIVED if all is ok', async () => {
        const res = await archiveProject.getRoomArchiveState(options);

        expect(res).to.eq(StateEnum.ARCHIVED);
        expect(messengerApi.kickUserByRoom).to.be.called;
        expect(messengerApi.deleteRoomAlias).to.be.called;
        expect(messengerApi.leaveRoom).to.be.called;
    });

    it('Expect return ROOM_NOT_RETURN_ALIAS if alias in room data is NULL', async () => {
        messengerApi.getRoomDataById.reset();
        messengerApi.getRoomDataById.resolves({ alias: null });
        const res = await archiveProject.getRoomArchiveState(options);

        expect(res).to.eq(StateEnum.ROOM_NOT_RETURN_ALIAS);
        expect(messengerApi.kickUserByRoom).not.to.be.called;
        expect(messengerApi.deleteRoomAlias).not.to.be.called;
        expect(messengerApi.leaveRoom).not.to.called;
    });

    it('Expect return MOVED if alias in room data not equals using alias', async () => {
        messengerApi.getRoomDataById.reset();
        messengerApi.getRoomDataById.resolves({ alias: 'some-other-name' });
        const res = await archiveProject.getRoomArchiveState(options);

        expect(res).to.eq(StateEnum.MOVED);
        expect(messengerApi.kickUserByRoom).not.to.be.called;
        expect(messengerApi.deleteRoomAlias).to.be.called;
        expect(messengerApi.leaveRoom).not.to.called;
    });

    it('Expect FORBIDDEN_EVENTS if git request return false, kick and alias is not calls', async () => {
        messengerApi.getAllEventsFromRoom.resolves(false);
        const res = await archiveProject.getRoomArchiveState(options);

        expect(res).to.eq(StateEnum.FORBIDDEN_EVENTS);
        expect(messengerApi.kickUserByRoom).not.to.called;
        expect(messengerApi.deleteRoomAlias).not.to.called;
        expect(messengerApi.leaveRoom).not.to.called;
    });

    it('Expect ERROR_ARCHIVING if git request return false, kick and alias is not calls', async () => {
        gitPullToRepoStub.resolves(false);
        const res = await archiveProject.getRoomArchiveState(options);

        expect(res).to.eq(StateEnum.ERROR_ARCHIVING);
        expect(messengerApi.kickUserByRoom).not.to.called;
        expect(messengerApi.deleteRoomAlias).not.to.called;
        expect(messengerApi.leaveRoom).not.to.called;
    });

    it('Expect STILL_ACTIVE return and no kick, delete alias and leave is called if timestamp is less than keep time', async () => {
        const res = await archiveProject.getRoomArchiveState({ ...options, keepTimestamp: info.maxTs - 10 });

        expect(res).to.eq(StateEnum.STILL_ACTIVE);
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
            const res = await archiveProject.getRoomArchiveState(options);

            expect(res).to.eq(StateEnum.ALIAS_REMOVED);
            expect(messengerApi.kickUserByRoom).not.to.called;
            expect(messengerApi.deleteRoomAlias).to.be.called;
            expect(messengerApi.leaveRoom).not.to.called;
        });

        it('Expect return OTHER_ALIAS_CREATOR if not exist alias creator in bot list', async () => {
            const res = await archiveProject.getRoomArchiveState(options);

            expect(res).to.eq(StateEnum.OTHER_ALIAS_CREATOR);
            expect(messengerApi.kickUserByRoom).not.to.called;
            expect(messengerApi.deleteRoomAlias).to.be.called;
            expect(messengerApi.leaveRoom).not.to.called;
        });
    });

    it('Expect issue is not found and archive wiil be running', async () => {
        const state = await archiveProject.getRoomArchiveState({
            ...options,
            status: 'some other status',
        });

        expect(state).to.eq(StateEnum.ARCHIVED);
        expect(messengerApi.kickUserByRoom).to.be.called;
        expect(messengerApi.deleteRoomAlias).to.be.called;
        expect(messengerApi.leaveRoom).to.be.called;
    });

    describe('Status exists', () => {
        beforeEach(() => {
            nock(taskTracker.getRestUrl())
                .get(`/issue/${alias}`)
                .reply(200, issueJSON);
        });

        it('Expect issue is in another status and archive not getRoomArchiveState', async () => {
            const state = await archiveProject.getRoomArchiveState({ ...options, status: 'some other status' });

            expect(state).to.eq(StateEnum.ANOTHER_STATUS);
            expect(messengerApi.kickUserByRoom).not.to.be.called;
            expect(messengerApi.deleteRoomAlias).not.to.be.called;
            expect(messengerApi.leaveRoom).not.to.be.called;
        });

        it('Expect issue is in correct status and archiving getRoomArchiveState', async () => {
            const state = await archiveProject.getRoomArchiveState({
                ...options,
                status: issueJSON.fields.status.name,
            });

            expect(state).to.eq(StateEnum.ARCHIVED);
            expect(messengerApi.kickUserByRoom).to.be.called;
            expect(messengerApi.deleteRoomAlias).to.be.called;
            expect(messengerApi.leaveRoom).to.be.called;
        });
    });
});

describe('Archive project', () => {
    it('Expect getLastMessageTimestamp return last message timestamp', () => {
        const res = ArchiveProject_.getLastMessageTimestamp(rawEvents);
        expect(res).to.eq(info.maxTs);
    });
});
