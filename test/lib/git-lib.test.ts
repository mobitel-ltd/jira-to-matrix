import * as faker from 'faker';
import * as tmp from 'tmp-promise';
import gitP from 'simple-git/promise';
import { config } from '../../src/config';
import * as fs from 'fs';
import * as path from 'path';
import {
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
} from '../../src/lib/git-lib';
import nock from 'nock';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { getChatClass, getRoomId, baseMedia, cleanRedis, startGitServer, setRepo, taskTracker } from '../test-utils';
import issueJSON from '../fixtures/jira-api-requests/issue.json';
import projectJSON from '../fixtures/jira-api-requests/project.json';
import { rawEvents } from '../fixtures/archiveRoom/raw-events';
import { info } from '../fixtures/archiveRoom/raw-events-data';
import eventBefore from '../fixtures/archiveRoom/already-exisits-git/res/$yQ0EVRodM3N5B2Id1M-XOvBlxAhFLy_Ex8fYqmrx5iA.json';

const { expect } = chai;
chai.use(sinonChai);

const messagesMD = fs.readFileSync(path.resolve(__dirname, '../fixtures/archiveRoom/allMessagesFromRoom.md'), 'utf8');
const infoMd = fs.readFileSync(path.resolve(__dirname, '../fixtures/archiveRoom/room-info.md'), 'utf8');
const messagesWithBefore = fs.readFileSync(
    path.resolve(__dirname, '../fixtures/archiveRoom/withbefore-readme.md'),
    'utf8',
);

const fsProm = fs.promises;

describe('Archive command', () => {
    let chatApi;
    const roomId = getRoomId();
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
        chatApi = getChatClass({ existedUsers: [notAdminSender] }).chatApiSingle;
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
        nock(baseMedia)
            .get(`/${info.mediaId}`)
            .replyWithFile(200, path.resolve(__dirname, '../fixtures/archiveRoom/media.jpg'))
            .get(`/${info.blobId}`)
            .replyWithFile(200, path.resolve(__dirname, '../fixtures/archiveRoom/media.jpg'))
            .get(`/${info.avatarId}`)
            .replyWithFile(200, path.resolve(__dirname, '../fixtures/archiveRoom/media.jpg'));

        nock(taskTracker.getRestUrl())
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
        await cleanRedis();
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
                url: info.blobUrl,
                fileName: `${info.blobId}${FILE_DELIMETER}${info.blobName}`,
                imageName: info.blobName,
                skip: true,
            },
            {
                url: info.avatarUrl,
                imageName: undefined,
                fileName: `${info.avatarId}${DEFAULT_EXT}`,
            },
            {
                url: info.imgUrl,
                imageName: info.mediaName,
                fileName: `${info.mediaId}${FILE_DELIMETER}${info.mediaName}`,
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
        const expectedRepoHttpLink = `${config.baseLink}/${projectKey.toLowerCase()}/tree/master/${issueKey}`;
        const expectedRepoGitLink = `${config.sshLink}/${projectKey.toLowerCase()}.git`;
        const expectedDefaultRemote = `${config.baseRemote}/${DEFAULT_REMOTE_NAME}.git`;
        const expectedDefaultRepoHttpLink = `${config.baseLink}/${DEFAULT_REMOTE_NAME}/tree/master/${issueKey}`;
        const expectedDefaultRepoGitLink = `${config.sshLink}/${DEFAULT_REMOTE_NAME}.git`;
        let server;
        let tmpDir;
        let configWithTmpPath;

        beforeEach(async () => {
            tmpDir = await tmp.dir({ unsafeCleanup: true });
            configWithTmpPath = { ...config, gitReposPath: tmpDir.path };

            server = startGitServer(path.resolve(tmpDir.path, 'git-server'));
            const pathToExistFixtures = path.resolve(__dirname, '../fixtures/archiveRoom/already-exisits-git');
            await setRepo(tmpDir.path, expectedRemote, { pathToExistFixtures, roomName: issueKey });
            await setRepo(tmpDir.path, expectedDefaultRemote, {
                roomName: issueKey,
            });
        });

        afterEach(() => {
            server.close();
            tmpDir.cleanup();
        });

        it('expect git pull send event data', async () => {
            const repoLinks = await exportEvents({
                ...configWithTmpPath,
                listEvents: rawEvents,
                roomData,
                chatApi,
                repoName: projectKey,
            });

            expect(repoLinks).to.deep.eq({
                httpLink: expectedRepoHttpLink,
                gitLink: expectedRepoGitLink,
                dirName: `${projectKey.toLowerCase()}/${issueKey}`,
            });

            const cloneName = 'clone-repo';
            const gitLocal = gitP(tmpDir.path);
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
                `${info.mediaId}${FILE_DELIMETER}${info.mediaName}`,
                `${info.blobId}${FILE_DELIMETER}${info.blobName}`,
                `${info.avatarId}${DEFAULT_EXT}`,
            ];
            expect(mediaFiles).to.have.length(expectedMediaFileNames.length);
            expect(mediaFiles).to.have.deep.members(expectedMediaFileNames);
        });

        it('expect git pull send event data ', async () => {
            const links = await exportEvents({
                ...configWithTmpPath,
                listEvents: [...rawEvents, eventBefore],
                roomData,
                chatApi,
            });

            expect(links).to.deep.eq({
                httpLink: expectedDefaultRepoHttpLink,
                gitLink: expectedDefaultRepoGitLink,
                dirName: `${DEFAULT_REMOTE_NAME}/${issueKey}`,
            });

            const cloneName = 'clone-repo';
            const gitLocal = gitP(tmpDir.path);
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
                `${info.mediaId}${FILE_DELIMETER}${info.mediaName}`,
                `${info.blobId}${FILE_DELIMETER}${info.blobName}`,
                `${info.avatarId}${DEFAULT_EXT}`,
            ];
            expect(mediaFiles).to.have.length(expectedMediaFileNames.length);
            expect(mediaFiles).to.have.deep.members(expectedMediaFileNames);
        });
    });
});
