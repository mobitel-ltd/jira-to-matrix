const faker = require('faker');
const tmp = require('tmp-promise');
const gitSimple = require('simple-git/promise');
const config = require('../../src/config');
const fs = require('fs');
const path = require('path');
const { getAliases } = require('../../src/bot/settings');

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

const { deleteAlias, KICK_ALL_OPTION, PERSONAL_REPO_OPTION } = require('../../src/bot/commands/command-list/archive');
const {
    DEFAULT_REMOTE_NAME,
    DEFAULT_EXT,
    EVENTS_DIR_NAME,
    VIEW_FILE_NAME,
    MEDIA_DIR_NAME,
    FILE_DELIMETER,
} = require('../../src/lib/git-lib');

const rawEvents = require('../fixtures/archiveRoom/raw-events');
const rawEventsData = require('../fixtures/archiveRoom/raw-events-data');
const commandHandler = require('../../src/bot/commands');
const utils = require('../../src/lib/utils');
const messagesWithBefore = fs.readFileSync(
    path.resolve(__dirname, '../fixtures/archiveRoom/withbefore-readme.md'),
    'utf8',
);
const readmeWithoutBefore = fs.readFileSync(path.resolve(__dirname, '../fixtures/archiveRoom/readme.md'), 'utf8');
const eventBefore = require('../fixtures/archiveRoom/already-exisits-git/res/$yQ0EVRodM3N5B2Id1M-XOvBlxAhFLy_Ex8fYqmrx5iA.json');

const fsProm = fs.promises;

describe('Archive command', () => {
    const kickAllWithPref = `--${KICK_ALL_OPTION}`;
    let chatApi;
    const roomName = issueJSON.key;
    const sender = getUserIdByDisplayName(issueJSON.fields.creator.displayname);
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
            config,
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
            .get(`/project/${projectKey}`)
            .reply(200, projectJSON);
    });

    afterEach(async () => {
        nock.cleanAll();
        await testUtils.cleanRedis();
    });

    it('expect not deleted alias is saved into redis', async () => {
        const alias = faker.random.word();
        const res = await deleteAlias(chatApi, alias);

        expect(res).to.be.undefined;

        const allAliases = await getAliases();
        expect(allAliases).to.include(alias);
    });

    // TODO set readable test case names
    it('Permition denided for not admin', async () => {
        const post = translate('notAdmin', { sender: 'notAdmin' });
        const result = await commandHandler({ ...baseOptions, sender: 'notAdmin' });
        expect(result).to.be.eq(post);
    });

    it('Permition denided if sender and bot not in task jira', async () => {
        const post = translate('issueNotExistOrPermDen');
        const notAvailableIssueKey = `${projectKey}-1010`;
        const roomDataWithNotExistAlias = { ...roomData, alias: notAvailableIssueKey };
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

    it('expect return repoNotExists if repo is not exists', async () => {
        const repoLink = `${config.baseLink}/${projectKey.toLowerCase()}`;
        const post = translate('repoNotExists', { repoLink });
        const result = await commandHandler({
            ...baseOptions,
            config: { ...config, baseRemote: 'lalalla' },
            sender: adminSender.name,
        });
        expect(result).to.be.eq(post);
    });

    it('expect return unknownArgs message body text have unexpected words', async () => {
        const text = 'lallaal';
        const result = await commandHandler({
            ...baseOptions,
            sender: adminSender.name,
            bodyText: text,
        });
        expect(result).to.be.eq(translate('unknownArgs', { unknownArgs: text }));
    });

    it('expect return unknownArgs message if body text have multiple unexpected words', async () => {
        const text = 'lallaal oooo -kickall';
        const result = await commandHandler({
            ...baseOptions,
            sender: adminSender.name,
            bodyText: [kickAllWithPref, text].join(' '),
        });
        expect(result).to.be.eq(translate('unknownArgs', { unknownArgs: text.split(' ') }));
    });

    it('expect return unknownArgs message if body text have multiple unexpected words around', async () => {
        const text1 = 'lallaal oooo -kickall';
        const text2 = '-h';
        const result = await commandHandler({
            ...baseOptions,
            sender: adminSender.name,
            bodyText: [text1, kickAllWithPref, text2].join(' '),
        });
        expect(result).to.be.eq(translate('unknownArgs', { unknownArgs: `${text1} ${text2}`.split(' ') }));
    });

    it('expect return unknownArgs message if body have option with one -', async () => {
        const result = await commandHandler({
            ...baseOptions,
            sender: adminSender.name,
            bodyText: `-${KICK_ALL_OPTION}`,
        });
        expect(result).to.be.eq(translate('unknownArgs', { unknownArgs: `-${KICK_ALL_OPTION}` }));
    });

    describe('archive with export', () => {
        let expectedRemote;
        let expectedRepoLink;
        let expectedDefaultRemote;
        let expectedRemoteWithCustomName;
        let expectedRepoLinkWithCustomName;
        let server;
        let tmpDir;
        let configWithTmpPath;

        beforeEach(async () => {
            const _repoName = chatApi.getChatUserId(adminSender.name).replace(/[^a-z0-9_.-]+/g, '__');
            const repoName = _repoName[0] === '_' ? _repoName.slice(2) : _repoName;

            expectedRemote = `${config.baseRemote}/${projectKey.toLowerCase()}.git`;
            expectedRepoLink = `${config.baseLink}/${projectKey.toLowerCase()}/tree/master/${issueKey}`;
            expectedDefaultRemote = `${config.baseRemote}/${DEFAULT_REMOTE_NAME}.git`;
            expectedRemoteWithCustomName = `${config.baseRemote}/${repoName.toLowerCase()}.git`;
            expectedRepoLinkWithCustomName = `${config.baseLink}/${repoName.toLowerCase()}/tree/master/${issueKey}`;
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

        it('expect command succeded', async () => {
            const result = await commandHandler({
                ...baseOptions,
                sender: adminSender.name,
                roomName: issueKey,
                config: configWithTmpPath,
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

        it('expect command succeded with custom repo name as option and kick all option', async () => {
            const bodyText = `${faker.random.arrayElement([
                `--${PERSONAL_REPO_OPTION}`,
                '-p',
            ])} ${faker.random.arrayElement([kickAllWithPref, '-k'])}`;
            const result = await commandHandler({
                ...baseOptions,
                sender: adminSender.name,
                roomName: issueKey,
                config: configWithTmpPath,
                bodyText,
            });

            expect(result).to.be.undefined;

            const cloneName = 'clone-repo';
            const gitLocal = gitSimple(tmpDir.path);
            await gitLocal.clone(expectedRemoteWithCustomName, cloneName);
            const files = await fsProm.readdir(path.resolve(tmpDir.path, cloneName, issueKey, EVENTS_DIR_NAME));
            const allEvents = rawEvents.map(event => `${event.event_id}.json`);
            expect(files).to.have.length(allEvents.length);
            expect(files).to.have.deep.members(allEvents);

            const viewFilePath = path.resolve(tmpDir.path, cloneName, issueKey, VIEW_FILE_NAME);
            expect(fs.existsSync(viewFilePath)).to.be.true;
            const viewFileData = (await fsProm.readFile(viewFilePath, 'utf8')).split('\n');
            expect(viewFileData).to.deep.equal(readmeWithoutBefore.split('\n'));

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
            expect(chatApi.deleteRoomAlias).not.to.be.called;
            expect(chatApi.leaveRoom).to.be.calledWithExactly(roomData.id);
            const expectedMsg = [
                translate('successExport', { link: expectedRepoLinkWithCustomName }),
                translate('adminsAreNotKicked'),
            ].join('<br>');
            expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, expectedMsg, expectedMsg);
        });

        it('expect command succeded with custom repo name as option', async () => {
            const bodyText = faker.random.arrayElement([`--${PERSONAL_REPO_OPTION}`, '-p']);
            const result = await commandHandler({
                ...baseOptions,
                sender: adminSender.name,
                roomName: issueKey,
                config: configWithTmpPath,
                bodyText,
            });
            const expectedMsg = translate('successExport', { link: expectedRepoLinkWithCustomName });

            expect(result).to.be.eq(expectedMsg);

            const cloneName = 'clone-repo';
            const gitLocal = gitSimple(tmpDir.path);
            await gitLocal.clone(expectedRemoteWithCustomName, cloneName);
            const files = await fsProm.readdir(path.resolve(tmpDir.path, cloneName, issueKey, EVENTS_DIR_NAME));
            const allEvents = rawEvents.map(event => `${event.event_id}.json`);
            expect(files).to.have.length(allEvents.length);
            expect(files).to.have.deep.members(allEvents);

            const viewFilePath = path.resolve(tmpDir.path, cloneName, issueKey, VIEW_FILE_NAME);
            expect(fs.existsSync(viewFilePath)).to.be.true;
            const viewFileData = (await fsProm.readFile(viewFilePath, 'utf8')).split('\n');
            expect(viewFileData).to.deep.equal(readmeWithoutBefore.split('\n'));

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

        it('expect command succeded and all simple members are kicked but admins not if they are exists', async () => {
            const roomName = issueKey;
            const bodyText = faker.random.arrayElement([kickAllWithPref, '-k']);
            const result = await commandHandler({
                ...baseOptions,
                roomName,
                sender: adminSender.name,
                bodyText,
                config: configWithTmpPath,
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
            expect(chatApi.deleteRoomAlias).not.to.be.called;
            expect(chatApi.leaveRoom).to.be.calledWithExactly(roomData.id);
            const expectedMsg = [
                translate('successExport', { link: expectedRepoLink }),
                translate('adminsAreNotKicked'),
            ].join('<br>');
            expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, expectedMsg, expectedMsg);
        });

        it('expect command succeded and all users are kicked if not other admins but alias is not deleted but saved', async () => {
            const roomName = issueKey;
            const bodyText = faker.random.arrayElement([kickAllWithPref, '-k']);
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
                bodyText,
                config: configWithTmpPath,
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
            expect(chatApi.deleteRoomAlias).to.be.calledWithExactly(roomData.alias);
            expect(await getAliases()).to.include(roomData.alias);
            expect(chatApi.leaveRoom).to.be.calledWithExactly(roomData.id);
            expect(chatApi.sendHtmlMessage).not.to.be.called;
        });

        it('expect command succeded but bot cannot kick anybody if power is less than 100', async () => {
            const bodyText = faker.random.arrayElement([kickAllWithPref, '-k']);
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
                config: configWithTmpPath,
                bodyText,
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
            expect(chatApi.deleteRoomAlias).not.to.be.called;
            expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, expectedMsg, expectedMsg);
        });

        it('command cannot be succeded if such project is not exists in git repo', async () => {
            chatApi.getDownloadLink.throws();
            const result = await commandHandler({
                ...baseOptions,
                config: configWithTmpPath,
                sender: adminSender.name,
            });
            const expected = translate('archiveFail', { alias: roomData.alias });

            expect(result).to.be.eq(expected);

            const cloneName = 'clone-repo';
            const gitLocal = gitSimple(tmpDir.path);
            const notExistRemote = `${configWithTmpPath.baseRemote + notExistProject}.git`;
            await gitLocal.clone(notExistRemote, cloneName);
            expect(fs.existsSync(path.resolve(tmpDir.path, cloneName, roomNameNotGitProject, EVENTS_DIR_NAME))).to.be
                .false;
        });

        // TODO
        // it('Expect not correct git access data inside config return message to chat after run command', () => true);
    });
});
