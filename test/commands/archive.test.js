const faker = require('faker');
const tmp = require('tmp-promise');
const gitSimple = require('simple-git/promise');
const config = require('../../src/config');
const fs = require('fs');
const path = require('path');
const { getUserIdByDisplayName } = require('../test-utils');
const nock = require('nock');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);
const translate = require('../../src/locales');
const testUtils = require('../test-utils');
const issueJSON = require('../fixtures/jira-api-requests/issue.json');
const {
    getHTMLtext,
    getMDtext,
    gitPullToRepo,
    EVENTS_DIR_NAME,
    MEDIA_DIR_NAME,
    KICK_ALL_OPTION,
    VIEW_FILE_NAME,
    transformEvent,
    getImageData,
    FILE_DELIMETER,
    DEFAULT_EXT,
} = require('../../src/bot/timeline-handler/commands/archive');

const rawEvents = require('../fixtures/archiveRoom/raw-events');
const rawEventsData = require('../fixtures/archiveRoom/raw-events-data');
const commandHandler = require('../../src/bot/timeline-handler');
const utils = require('../../src/lib/utils');
const messagesJSON = require('../fixtures/archiveRoom/allMessagesFromRoom.json');
const messagesMD = fs.readFileSync(path.resolve(__dirname, '../fixtures/archiveRoom/allMessagesFromRoom.md'), 'utf8');
const messagesWithBefore = fs.readFileSync(
    path.resolve(__dirname, '../fixtures/archiveRoom/withbefore-readme.md'),
    'utf8',
);
const eventBefore = require('../fixtures/archiveRoom/already-exisits-git/res/$yQ0EVRodM3N5B2Id1M-XOvBlxAhFLy_Ex8fYqmrx5iA.json');

const messagesHTML = fs.readFileSync(
    path.resolve(__dirname, '../fixtures/archiveRoom/allMessagesFromRoom.html'),
    'utf8',
);
const fsProm = fs.promises;

describe('Archive command', () => {
    let chatApi;
    const roomName = issueJSON.key;
    const sender = getUserIdByDisplayName(issueJSON.fields.creator);
    const roomId = testUtils.getRoomId();
    const commandName = 'archive';
    let baseOptions;
    let roomNameNotGitProject;
    let notExistProject;
    const notAdminSender = 'notAdmin';
    const [adminSender] = testUtils.roomAdmins;
    const projectKey = faker.name.firstName().toUpperCase();
    const existingRoomName = `${projectKey}-123`;

    beforeEach(() => {
        notExistProject = faker.name.firstName().toUpperCase();
        roomNameNotGitProject = `${notExistProject}-123`;
        chatApi = testUtils.getChatApi({ existedUsers: [notAdminSender] });
        baseOptions = { roomId, roomName, commandName, sender, chatApi };
        nock(testUtils.baseMedia)
            .get(`/${rawEventsData.mediaId}`)
            .replyWithFile(200, path.resolve(__dirname, '../fixtures/archiveRoom/media.jpg'))
            .get(`/${rawEventsData.blobId}`)
            .replyWithFile(200, path.resolve(__dirname, '../fixtures/archiveRoom/media.jpg'))
            .get(`/${rawEventsData.avatarId}`)
            .replyWithFile(200, path.resolve(__dirname, '../fixtures/archiveRoom/media.jpg'));

        nock(utils.getRestUrl())
            .get(`/issue/${issueJSON.key}`)
            .reply(200, issueJSON)
            .get(`/issue/${existingRoomName}`)
            .reply(200, issueJSON)
            .get(`/issue/${roomNameNotGitProject}`)
            .reply(200, issueJSON);
    });

    afterEach(() => {
        nock.cleanAll();
    });

    // TODO set readable test case names
    it('Permition denided for not admin', async () => {
        const post = translate('notAdmin', { sender: 'notAdmin' });
        const result = await commandHandler({ ...baseOptions, sender: 'notAdmin' });
        expect(result).to.be.eq(post);
    });

    it('transform event', () => {
        const res = rawEvents.map(transformEvent);
        res.forEach(element => {
            expect(element).not.includes('"age"');
        });
    });

    it('getFileNameByUrl', () => {
        const eventData = rawEvents.map(el => getImageData(el)).filter(Boolean);
        expect(eventData).to.have.deep.members([
            {
                url: rawEventsData.blobUrl,
                fileName: `${rawEventsData.blobId}${FILE_DELIMETER}${rawEventsData.blobName}`,
                imageName: rawEventsData.blobName,
                skip: true,
            },
            {
                url: rawEventsData.avatarUrl,
                imageName: undefined,
                fileName: `${rawEventsData.avatarId}${DEFAULT_EXT}`,
            },
            {
                url: rawEventsData.imgUrl,
                imageName: rawEventsData.mediaName,
                fileName: `${rawEventsData.mediaId}${FILE_DELIMETER}${rawEventsData.mediaName}`,
            },
        ]);
    });

    describe('Render list of messages', () => {
        it('Render MD', () => {
            const result = getMDtext(rawEvents).split('\n');
            expect(result).to.deep.equal(messagesMD.split('\n'));
        });

        it.skip('Render HTML', () => {
            const result = getHTMLtext(messagesJSON);
            expect(result).to.deep.equal(messagesHTML);
        });
    });

    describe('gitPull', () => {
        const expectedRemote = `${`${config.baseRemote}/${projectKey.toLowerCase()}`}.git`;
        let server;
        let tmpDir;

        beforeEach(async () => {
            tmpDir = await tmp.dir({ unsafeCleanup: true });
            server = testUtils.startGitServer(path.resolve(tmpDir.path, 'git-server'));
            const pathToExistFixtures = path.resolve(__dirname, '../fixtures/archiveRoom/already-exisits-git');
            await testUtils.setRepo(tmpDir.path, expectedRemote, { pathToExistFixtures, roomName: existingRoomName });
        });

        afterEach(() => {
            server.close();
            tmpDir.cleanup();
        });

        it('expect git pull send event data', async () => {
            const remote = await gitPullToRepo(config.baseRemote, rawEvents, existingRoomName, chatApi);

            expect(remote).to.eq(expectedRemote);

            const cloneName = 'clone-repo';
            const gitLocal = gitSimple(tmpDir.path);
            await gitLocal.clone(expectedRemote, cloneName);
            const files = await fsProm.readdir(path.resolve(tmpDir.path, cloneName, existingRoomName, EVENTS_DIR_NAME));
            const allEvents = [...rawEvents, eventBefore].map(event => `${event.event_id}.json`);
            expect(files).to.have.length(allEvents.length);
            expect(files).to.have.deep.members(allEvents);

            const viewFilePath = path.resolve(tmpDir.path, cloneName, existingRoomName, VIEW_FILE_NAME);
            expect(fs.existsSync(viewFilePath)).to.be.true;
            const viewFileData = (await fsProm.readFile(viewFilePath, 'utf8')).split('\n');
            expect(viewFileData).to.deep.equal(messagesWithBefore.split('\n'));

            const mediaFiles = await fsProm.readdir(
                path.resolve(tmpDir.path, cloneName, existingRoomName, MEDIA_DIR_NAME),
            );
            const expectedMediaFileNames = [
                `${rawEventsData.mediaId}${FILE_DELIMETER}${rawEventsData.mediaName}`,
                `${rawEventsData.blobId}${FILE_DELIMETER}${rawEventsData.blobName}`,
                `${rawEventsData.avatarId}${DEFAULT_EXT}`,
            ];
            expect(mediaFiles).to.have.length(expectedMediaFileNames.length);
            expect(mediaFiles).to.have.deep.members(expectedMediaFileNames);
        });

        it('expect command succeded', async () => {
            const result = await commandHandler({
                ...baseOptions,
                sender: adminSender.name,
                roomName: existingRoomName,
            });

            expect(result).to.be.eq(translate('successExport'));

            const cloneName = 'clone-repo';
            const gitLocal = gitSimple(tmpDir.path);
            await gitLocal.clone(expectedRemote, cloneName);
            const files = await fsProm.readdir(path.resolve(tmpDir.path, cloneName, existingRoomName, EVENTS_DIR_NAME));
            const allEvents = [...rawEvents, eventBefore].map(event => `${event.event_id}.json`);
            expect(files).to.have.length(allEvents.length);
            expect(files).to.have.deep.members(allEvents);

            const mediaFiles = await fsProm.readdir(
                path.resolve(tmpDir.path, cloneName, existingRoomName, MEDIA_DIR_NAME),
            );
            const expectedMediaFileNames = [
                `${rawEventsData.mediaId}${FILE_DELIMETER}${rawEventsData.mediaName}`,
                `${rawEventsData.blobId}${FILE_DELIMETER}${rawEventsData.blobName}`,
                `${rawEventsData.avatarId}${DEFAULT_EXT}`,
            ];
            expect(mediaFiles).to.have.length(expectedMediaFileNames.length);
            expect(mediaFiles).to.have.deep.members(expectedMediaFileNames);
        });

        it('expect command succeded and all members are kicked', async () => {
            const roomName = existingRoomName;
            const result = await commandHandler({
                ...baseOptions,
                roomName,
                sender: adminSender.name,
                bodyText: KICK_ALL_OPTION,
            });

            expect(result).to.be.undefined;

            const cloneName = 'clone-repo';
            const gitLocal = gitSimple(tmpDir.path);
            await gitLocal.clone(expectedRemote, cloneName);
            const files = await fsProm.readdir(path.resolve(tmpDir.path, cloneName, existingRoomName, EVENTS_DIR_NAME));
            const allEvents = [...rawEvents, eventBefore].map(event => `${event.event_id}.json`);
            expect(files).to.have.length(allEvents.length);
            expect(files).to.have.deep.members(allEvents);

            const mediaFiles = await fsProm.readdir(
                path.resolve(tmpDir.path, cloneName, existingRoomName, MEDIA_DIR_NAME),
            );
            const expectedMediaFileNames = [
                `${rawEventsData.mediaId}${FILE_DELIMETER}${rawEventsData.mediaName}`,
                `${rawEventsData.blobId}${FILE_DELIMETER}${rawEventsData.blobName}`,
                `${rawEventsData.avatarId}${DEFAULT_EXT}`,
            ];
            expect(mediaFiles).to.have.length(expectedMediaFileNames.length);
            expect(mediaFiles).to.have.deep.members(expectedMediaFileNames);
            testUtils.allRoomMembers.forEach(({ name }) =>
                expect(chatApi.kickUserByRoom).to.be.calledWithExactly({ roomId, userId: chatApi.getChatUserId(name) }),
            );
            expect(chatApi.deleteAliasByRoomName).to.be.calledWithExactly(roomName);
        });

        it.skip('command cannot be succeded if such project is not exists in git repo', async () => {
            const result = await commandHandler({
                ...baseOptions,
                sender: adminSender.name,
                roomName: roomNameNotGitProject,
            });
            const expected = translate('archiveFail', { roomName: roomNameNotGitProject });

            expect(result).to.be.eq(expected);

            const cloneName = 'clone-repo';
            const gitLocal = gitSimple(tmpDir.path);
            const notExistRemote = `${config.baseRemote + notExistProject}.git`;
            await gitLocal.clone(notExistRemote, cloneName);
            expect(fs.existsSync(path.resolve(tmpDir.path, cloneName, roomNameNotGitProject, EVENTS_DIR_NAME))).to.be
                .false;
        });

        // TODO
        it('Expect not correct git access data inside config return message to chat after run command', () => true);
    });
});
