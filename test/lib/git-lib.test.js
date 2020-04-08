const faker = require('faker');
const tmp = require('tmp-promise');
const gitSimple = require('simple-git/promise');
const config = require('../../src/config');
const fs = require('fs');
const path = require('path');
const {
    getMDtext,
    exportEvents,
    EVENTS_DIR_NAME,
    MEDIA_DIR_NAME,
    VIEW_FILE_NAME,
    DEFAULT_EXT,
    transformEvent,
    getImageData,
    FILE_DELIMETER,
    DEFAULT_REMOTE_NAME,
    getRoomMainInfoMd,
} = require('../../src/lib/git-lib');

const nock = require('nock');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);
const testUtils = require('../test-utils');
const issueJSON = require('../fixtures/jira-api-requests/issue.json');
const projectJSON = require('../fixtures/jira-api-requests/project.json');

const rawEvents = require('../fixtures/archiveRoom/raw-events');
const rawEventsData = require('../fixtures/archiveRoom/raw-events-data');
const utils = require('../../src/lib/utils');
const messagesMD = fs.readFileSync(path.resolve(__dirname, '../fixtures/archiveRoom/allMessagesFromRoom.md'), 'utf8');
const infoMd = fs.readFileSync(path.resolve(__dirname, '../fixtures/archiveRoom/room-info.md'), 'utf8');
const messagesWithBefore = fs.readFileSync(
    path.resolve(__dirname, '../fixtures/archiveRoom/withbefore-readme.md'),
    'utf8',
);
const eventBefore = require('../fixtures/archiveRoom/already-exisits-git/res/$yQ0EVRodM3N5B2Id1M-XOvBlxAhFLy_Ex8fYqmrx5iA.json');

const fsProm = fs.promises;

describe('Archive command', () => {
    let chatApi;
    const roomId = testUtils.getRoomId();
    let roomNameNotGitProject;
    let notExistProject;
    const notAdminSender = 'notAdmin';
    const projectKey = 'MYPROJECTKEY';
    // This alias exists in md head file and should assert
    const issueKey = `${projectKey}-123`;
    let roomData;
    const simpleMembers = [
        {
            userId: '@member1:matrix.test.com',
            powerLevel: 0,
        },
        {
            userId: '@member2:matrix.test.com',
            powerLevel: 50,
        },
    ];

    const admin = [
        {
            userId: '@member3:matrix.test.com',
            powerLevel: 100,
        },
    ];

    const baseMembers = [...simpleMembers, ...admin];

    beforeEach(() => {
        notExistProject = faker.name.firstName().toUpperCase();
        roomNameNotGitProject = `${notExistProject}-123`;
        chatApi = testUtils.getChatApi({ existedUsers: [notAdminSender] });
        roomData = {
            alias: issueKey,
            topic: 'room topic',
            name: 'room name',
            // default "roomId"
            id: roomId,
            members: [
                ...baseMembers,
                {
                    userId: `@${chatApi.getMyId()}:matrix.test.com`,
                    powerLevel: 100,
                },
            ],
        };
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
            .get(`/issue/${issueKey}`)
            .reply(200, issueJSON)
            .get(`/issue/${roomNameNotGitProject}`)
            .reply(200, issueJSON)
            .get(`/project/${projectKey}`)
            .reply(200, projectJSON);
    });

    afterEach(async () => {
        nock.cleanAll();
        await testUtils.cleanRedis();
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

        it('Render info MD', () => {
            const result = getRoomMainInfoMd(roomData).split('\n');
            expect(result).to.deep.equal(infoMd.split('\n'));
        });

        // it.skip('Render HTML', () => {
        //     const result = getHTMLtext(messagesJSON);
        //     expect(result).to.deep.equal(messagesHTML);
        // });
    });

    describe('gitPull', () => {
        const expectedRemote = `${config.baseRemote}/${projectKey.toLowerCase()}.git`;
        const expectedRepoLink = `${config.baseLink}/${projectKey.toLowerCase()}/tree/master/${issueKey}`;
        const expectedDefaultRemote = `${config.baseRemote}/${DEFAULT_REMOTE_NAME}.git`;
        const expectedDefaultRepoLink = `${config.baseLink}/${DEFAULT_REMOTE_NAME}/tree/master/${issueKey}`;
        let server;
        let tmpDir;
        let configWithTmpPath;

        beforeEach(async () => {
            tmpDir = await tmp.dir({ unsafeCleanup: true });
            configWithTmpPath = { ...config, gitReposPath: tmpDir.path };

            server = testUtils.startGitServer(path.resolve(tmpDir.path, 'git-server'));
            const pathToExistFixtures = path.resolve(__dirname, '../fixtures/archiveRoom/already-exisits-git');
            await testUtils.setRepo(tmpDir.path, expectedRemote, { pathToExistFixtures, roomName: issueKey });
            await testUtils.setRepo(tmpDir.path, expectedDefaultRemote, {
                roomName: issueKey,
            });
        });

        afterEach(() => {
            server.close();
            tmpDir.cleanup();
        });

        it('expect git pull send event data', async () => {
            const linkToRepo = await exportEvents({
                ...configWithTmpPath,
                listEvents: rawEvents,
                roomData,
                chatApi,
                repoName: projectKey,
            });

            expect(linkToRepo).to.eq(expectedRepoLink);

            const cloneName = 'clone-repo';
            const gitLocal = gitSimple(tmpDir.path);
            await gitLocal.clone(expectedRemote, cloneName);
            const files = await fsProm.readdir(path.resolve(tmpDir.path, cloneName, issueKey, EVENTS_DIR_NAME));
            const allEvents = [...rawEvents, eventBefore].map(event => `${event.event_id}.json`);
            expect(files).to.have.length(allEvents.length);
            expect(files).to.have.deep.members(allEvents);

            const viewFilePath = path.resolve(tmpDir.path, cloneName, issueKey, VIEW_FILE_NAME);
            expect(fs.existsSync(viewFilePath)).to.be.true;
            const viewFileData = (await fsProm.readFile(viewFilePath, 'utf8')).split('\n');
            expect(viewFileData).to.deep.equal(messagesWithBefore.split('\n'));

            const mediaFiles = await fsProm.readdir(path.resolve(tmpDir.path, cloneName, issueKey, MEDIA_DIR_NAME));
            const expectedMediaFileNames = [
                `${rawEventsData.mediaId}${FILE_DELIMETER}${rawEventsData.mediaName}`,
                `${rawEventsData.blobId}${FILE_DELIMETER}${rawEventsData.blobName}`,
                `${rawEventsData.avatarId}${DEFAULT_EXT}`,
            ];
            expect(mediaFiles).to.have.length(expectedMediaFileNames.length);
            expect(mediaFiles).to.have.deep.members(expectedMediaFileNames);
        });

        it('expect git pull send event data', async () => {
            const linkToRepo = await exportEvents({
                ...configWithTmpPath,
                listEvents: [...rawEvents, eventBefore],
                roomData,
                chatApi,
            });

            expect(linkToRepo).to.eq(expectedDefaultRepoLink);

            const cloneName = 'clone-repo';
            const gitLocal = gitSimple(tmpDir.path);
            await gitLocal.clone(expectedDefaultRemote, cloneName);
            const files = await fsProm.readdir(path.resolve(tmpDir.path, cloneName, issueKey, EVENTS_DIR_NAME));
            const allEvents = [...rawEvents, eventBefore].map(event => `${event.event_id}.json`);
            expect(files).to.have.length(allEvents.length);
            expect(files).to.have.deep.members(allEvents);

            const viewFilePath = path.resolve(tmpDir.path, cloneName, issueKey, VIEW_FILE_NAME);
            expect(fs.existsSync(viewFilePath)).to.be.true;
            const viewFileData = (await fsProm.readFile(viewFilePath, 'utf8')).split('\n');
            expect(viewFileData).to.deep.equal(messagesWithBefore.split('\n'));

            const mediaFiles = await fsProm.readdir(path.resolve(tmpDir.path, cloneName, issueKey, MEDIA_DIR_NAME));
            const expectedMediaFileNames = [
                `${rawEventsData.mediaId}${FILE_DELIMETER}${rawEventsData.mediaName}`,
                `${rawEventsData.blobId}${FILE_DELIMETER}${rawEventsData.blobName}`,
                `${rawEventsData.avatarId}${DEFAULT_EXT}`,
            ];
            expect(mediaFiles).to.have.length(expectedMediaFileNames.length);
            expect(mediaFiles).to.have.deep.members(expectedMediaFileNames);
        });
    });
});
