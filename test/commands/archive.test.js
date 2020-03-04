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
    KICK_ALL_OPTION,
} = require('../../src/bot/timeline-handler/commands/archive');

const rawEvents = require('../fixtures/archiveRoom/raw-events');
const commandHandler = require('../../src/bot/timeline-handler');
const utils = require('../../src/lib/utils');
const messagesJSON = require('../fixtures/archiveRoom/allMessagesFromRoom.json');
const messagesMD = fs.readFileSync(path.resolve(__dirname, '../fixtures/archiveRoom/allMessagesFromRoom.md'), 'utf8');
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

    describe('Render list of messages', () => {
        it('Render MD', () => {
            const result = getMDtext(messagesJSON).split('\n');
            expect(result).to.deep.equal(messagesMD.split('\n'));
        });

        it.skip('Render HTML', () => {
            const result = getHTMLtext(messagesJSON);
            expect(result).to.deep.equal(messagesHTML);
        });
    });

    describe.only('gitPull', () => {
        const expectedRemote = `${`${config.baseRemote}/${projectKey.toLowerCase()}`}.git`;
        let server;
        let tmpDir;

        beforeEach(async () => {
            tmpDir = await tmp.dir({ unsafeCleanup: true });
            server = testUtils.startGitServer(path.resolve(tmpDir.path, 'git-server'));
            await testUtils.setRepo(tmpDir.path, expectedRemote);
        });

        afterEach(() => {
            server.close();
            tmpDir.cleanup();
        });

        it('expect git pull send event data', async () => {
            const remote = await gitPullToRepo(config.baseRemote, rawEvents, projectKey, roomName);

            expect(remote).to.eq(expectedRemote);

            const cloneName = 'clone-repo';
            const gitLocal = gitSimple(tmpDir.path);
            await gitLocal.clone(expectedRemote, cloneName);
            const files = await fsProm.readdir(path.resolve(tmpDir.path, cloneName, roomName, EVENTS_DIR_NAME));
            expect(files).to.have.deep.members(rawEvents.map(event => `${event.event_id}.json`));
        });

        it('expect git pull send event data', async () => {
            const remote = await gitPullToRepo(config.baseRemote, rawEvents, projectKey, roomName);

            expect(remote).to.eq(expectedRemote);

            const cloneName = 'clone-repo';
            const gitLocal = gitSimple(tmpDir.path);
            await gitLocal.clone(expectedRemote, cloneName);
            const files = await fsProm.readdir(path.resolve(tmpDir.path, cloneName, roomName, EVENTS_DIR_NAME));
            expect(files).to.have.deep.members(rawEvents.map(event => `${event.event_id}.json`));
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
            expect(files).to.have.deep.members(rawEvents.map(event => `${event.event_id}.json`));
        });

        it('expect command succeded and all members are kicked', async () => {
            const result = await commandHandler({
                ...baseOptions,
                sender: adminSender.name,
                roomName: existingRoomName,
                bodyText: KICK_ALL_OPTION,
            });

            expect(result).to.be.eq(translate('exportWithKick'));

            const cloneName = 'clone-repo';
            const gitLocal = gitSimple(tmpDir.path);
            await gitLocal.clone(expectedRemote, cloneName);
            const files = await fsProm.readdir(path.resolve(tmpDir.path, cloneName, existingRoomName, EVENTS_DIR_NAME));
            expect(files).to.have.deep.members(rawEvents.map(event => `${event.event_id}.json`));
            // TODO
            // expect(chatApi.deleteAlias).to.be.calledWithExactly(roomAlias);
        });

        it.skip('command cannot be succeded if such project is not exists in git repo', async () => {
            const result = await commandHandler({
                ...baseOptions,
                sender: adminSender.name,
                roomName: roomNameNotGitProject,
            });
            const expected = translate('gitCommand', { projectKey: notExistProject });

            expect(result).to.be.eq(expected);

            const cloneName = 'clone-repo';
            const gitLocal = gitSimple(tmpDir.path);
            const notExistRemote = `${config.baseRemote + notExistProject}.git`;
            await gitLocal.clone(notExistRemote, cloneName);
            expect(fs.existsSync(path.resolve(tmpDir.path, cloneName, roomNameNotGitProject, EVENTS_DIR_NAME))).to.be
                .false;
        });

        // TODO
        it('Expect not correct git access data in config return message to chat after run command', () => true);
    });
});
