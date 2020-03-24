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
const projectJSON = require('../fixtures/jira-api-requests/project.json');

const {
    getGroupedUsers,
    // getHTMLtext,
    getMDtext,
    gitPullToRepo,
    EVENTS_DIR_NAME,
    MEDIA_DIR_NAME,
    KICK_ALL_OPTION,
    VIEW_FILE_NAME,
    transformEvent,
    roomNameHasJiraProject,
    getImageData,
    FILE_DELIMETER,
    DEFAULT_EXT,
    DEFAULT_REMOTE_NAME,
    getRoomMainInfoMd,
} = require('../../src/bot/timeline-handler/commands/archive');

const rawEvents = require('../fixtures/archiveRoom/raw-events');
const rawEventsData = require('../fixtures/archiveRoom/raw-events-data');
const commandHandler = require('../../src/bot/timeline-handler');
const utils = require('../../src/lib/utils');
// const messagesJSON = require('../fixtures/archiveRoom/allMessagesFromRoom.json');
const messagesMD = fs.readFileSync(path.resolve(__dirname, '../fixtures/archiveRoom/allMessagesFromRoom.md'), 'utf8');
const infoMd = fs.readFileSync(path.resolve(__dirname, '../fixtures/archiveRoom/room-info.md'), 'utf8');
const messagesWithBefore = fs.readFileSync(
    path.resolve(__dirname, '../fixtures/archiveRoom/withbefore-readme.md'),
    'utf8',
);
const eventBefore = require('../fixtures/archiveRoom/already-exisits-git/res/$yQ0EVRodM3N5B2Id1M-XOvBlxAhFLy_Ex8fYqmrx5iA.json');

// const messagesHTML = fs.readFileSync(
//     path.resolve(__dirname, '../fixtures/archiveRoom/allMessagesFromRoom.html'),
//     'utf8',
// );
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
        baseOptions = {
            roomId,
            roomName,
            commandName,
            sender,
            chatApi,
            roomData,
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
            .get(`/project/INDEV`)
            .reply(200, projectJSON)
            .get(`/project/${projectKey}`)
            .reply(200, projectJSON);
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

    it('Permition denided if sender and bot not in task jira', async () => {
        const post = translate('roomNotExistOrPermDen');
        const roomDataWithNotExistAlias = { ...roomData, alias: 'INDEV-999' };
        const result = await commandHandler({
            ...baseOptions,
            sender: adminSender.name,
            roomData: roomDataWithNotExistAlias,
        });
        expect(result).to.be.eq(post);
    });

    it('Expect send skip archive if room has no alias', async () => {
        const post = translate('noAlias');
        const roomDataWithoutAlias = { ...roomData, alias: null };
        const result = await commandHandler({
            ...baseOptions,
            sender: adminSender.name,
            roomData: roomDataWithoutAlias,
        });
        expect(result).to.be.eq(post);
    });

    it('transform event', () => {
        const res = rawEvents.map(transformEvent);
        res.forEach(element => {
            expect(element).not.includes('"age"');
        });
    });

    it('groupUsers test', () => {
        const admins = Array.from({ length: 5 }, () => ({ userId: faker.random.alphaNumeric(10), powerLevel: 100 }));
        const simpleUsers = Array.from({ length: 5 }, () => ({
            userId: faker.random.alphaNumeric(10),
            powerLevel: faker.random.number(99),
        }));
        const bot = Array.from({ length: 1 }, () => ({ userId: faker.random.alphaNumeric(10), powerLevel: 100 }));
        const data = [...bot, ...admins, ...simpleUsers];

        const expectedData = {
            simpleUsers: simpleUsers.map(user => user.userId),
            bot: bot.map(user => user.userId),
            admins: admins.map(user => user.userId),
        };

        expect(getGroupedUsers(data, bot[0].userId)).deep.eq(expectedData);
    });

    it('groupUsers test return empty array for each group if no such user exists', () => {
        const bot = Array.from({ length: 1 }, () => ({ userId: faker.random.alphaNumeric(10), powerLevel: 100 }));
        const data = bot;

        const expectedData = {
            simpleUsers: [],
            bot: bot.map(user => user.userId),
            admins: [],
        };

        expect(getGroupedUsers(data, bot[0].userId)).deep.eq(expectedData);
    });

    it('Default or not default', async () => {
        const checkProjectRoom = await roomNameHasJiraProject('INDEV-123');
        expect(checkProjectRoom).to.be.true;
        const checkNotProjectRoom = await roomNameHasJiraProject('hjshhhhd');
        expect(checkNotProjectRoom).to.be.false;
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

        beforeEach(async () => {
            tmpDir = await tmp.dir({ unsafeCleanup: true });
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
            const isJira = true;
            const linkToRepo = await gitPullToRepo(config, rawEvents, roomData, chatApi, isJira);

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
            const isJira = false;
            const linkToRepo = await gitPullToRepo(config, [...rawEvents, eventBefore], roomData, chatApi, isJira);

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

        it('expect command succeded', async () => {
            const result = await commandHandler({
                ...baseOptions,
                sender: adminSender.name,
                roomName: issueKey,
            });
            const expectedMsg = translate('successExport', { link: expectedRepoLink });

            expect(result).to.be.eq(expectedMsg);

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
            expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, expectedMsg, expectedMsg);
        });

        it('expect command succeded and all simple membera are kicked but admins not if they are exists', async () => {
            const roomName = issueKey;
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
            simpleMembers.forEach(({ userId }) =>
                expect(chatApi.kickUserByRoom).to.be.calledWithExactly({ roomId, userId }),
            );
            expect(chatApi.deleteAliasByRoomName).not.to.be.called;
            expect(chatApi.leaveRoom).to.be.calledWithExactly(roomData.id);
            const expectedMsg = [
                translate('successExport', { link: expectedRepoLink }),
                translate('adminsAreNotKicked'),
            ].join('<br>');
            expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, expectedMsg, expectedMsg);
        });

        it('expect command succeded but bot cannot and all users are kicked if not other admins', async () => {
            const roomName = issueKey;
            const roomDataWihotAdmins = {
                ...roomData,
                members: [
                    ...simpleMembers,
                    {
                        userId: `@${chatApi.getMyId()}:matrix.test.com`,
                        powerLevel: 100,
                    },
                ],
            };
            const result = await commandHandler({
                ...baseOptions,
                roomData: roomDataWihotAdmins,
                roomName,
                sender: adminSender.name,
                bodyText: KICK_ALL_OPTION,
            });
            expect(result).to.be.undefined;

            const cloneName = 'clone-repo';
            const gitLocal = gitSimple(tmpDir.path);
            await gitLocal.clone(expectedRemote, cloneName);
            const files = await fsProm.readdir(path.resolve(tmpDir.path, cloneName, issueKey, EVENTS_DIR_NAME));
            const allEvents = [...rawEvents, eventBefore].map(event => `${event.event_id}.json`);
            expect(files).to.have.length(allEvents.length);
            expect(files).to.have.deep.members(allEvents);

            const mediaFiles = await fsProm.readdir(path.resolve(tmpDir.path, cloneName, issueKey, MEDIA_DIR_NAME));
            const expectedMediaFileNames = [
                `${rawEventsData.mediaId}${FILE_DELIMETER}${rawEventsData.mediaName}`,
                `${rawEventsData.blobId}${FILE_DELIMETER}${rawEventsData.blobName}`,
                `${rawEventsData.avatarId}${DEFAULT_EXT}`,
            ];
            expect(mediaFiles).to.have.length(expectedMediaFileNames.length);
            expect(mediaFiles).to.have.deep.members(expectedMediaFileNames);
            simpleMembers.forEach(({ userId }) =>
                expect(chatApi.kickUserByRoom).to.be.calledWithExactly({ roomId, userId }),
            );
            expect(chatApi.deleteAliasByRoomName).to.be.calledWithExactly(roomData.alias);
            expect(chatApi.leaveRoom).to.be.calledWithExactly(roomData.id);
            expect(chatApi.sendHtmlMessage).not.to.be.called;
        });

        it('expect command succeded but bot cannot kick anybody if power is less than 100', async () => {
            const roomName = issueKey;
            const roomDataWihLessPower = {
                ...roomData,
                members: [
                    ...baseMembers,
                    {
                        userId: `@${chatApi.getMyId()}:matrix.test.com`,
                        powerLevel: 99,
                    },
                ],
            };
            const result = await commandHandler({
                ...baseOptions,
                roomData: roomDataWihLessPower,
                roomName,
                sender: adminSender.name,
                bodyText: KICK_ALL_OPTION,
            });
            const expectedMsg = [
                translate('successExport', { link: expectedRepoLink }),
                translate('noBotPower', { power: 100 }),
            ].join('<br>');

            expect(result).to.eq(expectedMsg);

            const cloneName = 'clone-repo';
            const gitLocal = gitSimple(tmpDir.path);
            await gitLocal.clone(expectedRemote, cloneName);
            const files = await fsProm.readdir(path.resolve(tmpDir.path, cloneName, issueKey, EVENTS_DIR_NAME));
            const allEvents = [...rawEvents, eventBefore].map(event => `${event.event_id}.json`);
            expect(files).to.have.length(allEvents.length);
            expect(files).to.have.deep.members(allEvents);

            const mediaFiles = await fsProm.readdir(path.resolve(tmpDir.path, cloneName, issueKey, MEDIA_DIR_NAME));
            const expectedMediaFileNames = [
                `${rawEventsData.mediaId}${FILE_DELIMETER}${rawEventsData.mediaName}`,
                `${rawEventsData.blobId}${FILE_DELIMETER}${rawEventsData.blobName}`,
                `${rawEventsData.avatarId}${DEFAULT_EXT}`,
            ];
            expect(mediaFiles).to.have.length(expectedMediaFileNames.length);
            expect(mediaFiles).to.have.deep.members(expectedMediaFileNames);
            expect(chatApi.kickUserByRoom).not.to.be.called;
            expect(chatApi.deleteAliasByRoomName).not.to.be.called;
            expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, expectedMsg, expectedMsg);
        });

        it('command cannot be succeded if such project is not exists in git repo', async () => {
            chatApi.getDownloadLink.throws();
            const result = await commandHandler({
                ...baseOptions,
                sender: adminSender.name,
            });
            const expected = translate('archiveFail', { alias: roomData.alias });

            expect(result).to.be.eq(expected);

            const cloneName = 'clone-repo';
            const gitLocal = gitSimple(tmpDir.path);
            const notExistRemote = `${config.baseRemote + notExistProject}.git`;
            await gitLocal.clone(notExistRemote, cloneName);
            expect(fs.existsSync(path.resolve(tmpDir.path, cloneName, roomNameNotGitProject, EVENTS_DIR_NAME))).to.be
                .false;
        });

        // TODO
        // it('Expect not correct git access data inside config return message to chat after run command', () => true);
    });
});
