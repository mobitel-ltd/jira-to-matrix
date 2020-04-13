const { random } = require('faker');
const { cleanRedis, getUserIdByDisplayName } = require('../test-utils');
const nock = require('nock');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);
const translate = require('../../src/locales');
const redis = require('../../src/redis-client');
const testUtils = require('../test-utils');
const jiraProject = require('../fixtures/jira-api-requests/project-gens/classic/correct.json');
const jiraProjectNewGen = require('../fixtures/jira-api-requests/project-gens/new-gen/correct.json');
const adminsProject = require('../fixtures/jira-api-requests/project-gens/admins-project.json');

const commandHandler = require('../../src/bot/commands');
const utils = require('../../src/lib/utils');

describe('Invite setting for projects', () => {
    let chatApi;
    const roomName = `${jiraProject.key}-123`;
    const projectKey = jiraProject.key;
    const projectId = jiraProject.id;
    const sender = getUserIdByDisplayName(jiraProject.lead.displayName);
    const roomId = random.number();
    const commandName = 'autoinvite';
    const bodyText = '';
    const { issueTypes } = jiraProject;
    let baseOptions;
    const projectIssueTypes = issueTypes.map(item => item.name);
    let issueType;
    let anotherTaskName;
    const notUsedIssueTypes = random.word();
    const notExistedCommand = random.word();
    const correctUser = 'myCorrectUser';
    const anotherCorrectUser = 'myCorrectUser2';

    beforeEach(() => {
        // await redis.setAsync(utils.REDIS_IGNORE_PREFIX, JSON.stringify({[projectKey]: {}}));
        chatApi = testUtils.getChatApi({ existedUsers: [correctUser, anotherCorrectUser] });
        baseOptions = { roomId, roomName, commandName, sender, chatApi, bodyText };
        issueType = random.arrayElement(projectIssueTypes);
        anotherTaskName = projectIssueTypes.find(item => item !== issueType);
        nock(utils.getRestUrl())
            .get(`/project/${projectKey}`)
            .reply(200, jiraProject)
            .get(`/project/${projectId}/role/10002`)
            .reply(200, adminsProject);
    });

    afterEach(async () => {
        nock.cleanAll();
        await cleanRedis();
    });

    // TODO set readable test case names
    it('Permition denided for not admin in projects', async () => {
        const post = translate('notAdmin', { sender: 'notAdmin' });
        const result = await commandHandler({ ...baseOptions, sender: 'notAdmin' });
        expect(result).to.be.eq(post);
    });

    it('Expect empty body - empty list', async () => {
        const post = translate('emptySettingsList', { projectKey });
        const result = await commandHandler(baseOptions);
        expect(result).to.be.eq(post);
    });

    it('Exist command and empty key', async () => {
        const post = translate('invalidCommand');
        const result = await commandHandler({ ...baseOptions, bodyText: 'add' });
        expect(result).to.be.eq(post);
    });

    it('Exist command and key not in project', async () => {
        const post = utils.ignoreKeysInProject(projectKey, projectIssueTypes);
        const result = await commandHandler({ ...baseOptions, bodyText: `add ${notUsedIssueTypes} ii_petrov` });
        expect(result).to.be.eq(post);
    });

    it('Exist user not in matrix', async () => {
        const post = translate('notInMatrix', { userFromCommand: 'notInMatrixtUser' });
        const result = await commandHandler({ ...baseOptions, bodyText: `add ${issueType} notInMatrixtUser` });
        expect(result).to.be.eq(post);
    });

    it('Success add key', async () => {
        const post = translate('autoinviteKeyAdded', {
            projectKey,
            matrixUserFromCommand: await chatApi.getChatUserId(correctUser),
            typeTaskFromUser: issueType,
        });
        const result = await commandHandler({ ...baseOptions, bodyText: `add ${issueType} ${correctUser}` });
        expect(result).to.be.eq(post);

        const res = await redis.getAsync(utils.REDIS_INVITE_PREFIX);
        expect(res).include(correctUser);
    });

    it('Success add key admin (not lead)', async () => {
        const post = translate('autoinviteKeyAdded', {
            projectKey,
            matrixUserFromCommand: chatApi.getChatUserId(correctUser),
            typeTaskFromUser: issueType,
        });
        const result = await commandHandler({
            ...baseOptions,
            bodyText: `add ${issueType} ${correctUser}`,
            sender: 'ii_ivanov',
        });
        expect(result).to.be.eq(post);
    });

    it('Command not found', async () => {
        const post = translate('invalidCommand');
        const result = await commandHandler({ ...baseOptions, bodyText: `${notExistedCommand} ${issueType}` });
        expect(result).to.be.eq(post);
    });

    describe('With already exists key in redis', () => {
        beforeEach(async () => {
            await redis.setAsync(
                utils.REDIS_INVITE_PREFIX,
                JSON.stringify({ [projectKey]: { [issueType]: [correctUser] } }),
            );
        });

        it('Delete key, not in ignore list', async () => {
            const post = translate('keyNotFoundForDelete', { projectKey });
            const result = await commandHandler({
                ...baseOptions,
                bodyText: `del ${anotherTaskName} ${anotherCorrectUser}`,
            });
            expect(result).to.be.eq(post);
        });

        it('Success delete key', async () => {
            const post = translate('autoinviteKeyDeleted', {
                projectKey,
                matrixUserFromCommand: correctUser,
                typeTaskFromUser: issueType,
            });
            const result = await commandHandler({ ...baseOptions, bodyText: `del ${issueType} ${correctUser}` });
            expect(result).to.be.eq(post);
        });

        it('Add key, such already added', async () => {
            const post = translate('keyAlreadyExistForAdd', { typeTaskFromUser: correctUser, projectKey });
            const result = await commandHandler({ ...baseOptions, bodyText: `add ${issueType} ${correctUser}` });
            expect(result).to.be.eq(post);
        });

        it('Expect empty body - full list', async () => {
            const post = utils.getIgnoreTips(projectKey, [[issueType, [correctUser]]], 'autoinvite');
            const result = await commandHandler(baseOptions);
            expect(result).to.be.eq(post);
        });
    });
});

describe('Ignore setting for projects, check admins for next-gen projects', () => {
    let chatApi;
    const roomName = `${jiraProjectNewGen.key}-123`;
    const projectKey = jiraProjectNewGen.key;
    const projectId = jiraProjectNewGen.id;
    const sender = jiraProjectNewGen.lead.name;
    const roomId = random.number();
    const commandName = 'ignore';
    const bodyText = '';
    const { issueTypes } = jiraProjectNewGen;
    let baseOptions;
    const projectIssueTypes = issueTypes.map(item => item.name);
    let issueType;

    beforeEach(() => {
        // await redis.setAsync(utils.REDIS_IGNORE_PREFIX, JSON.stringify({[projectKey]: {}}));
        chatApi = testUtils.getChatApi();
        baseOptions = { roomId, roomName, commandName, sender, chatApi, bodyText };
        issueType = random.arrayElement(projectIssueTypes);
        nock(utils.getRestUrl())
            .get(`/project/${projectKey}`)
            .reply(200, jiraProjectNewGen)
            .get(`/project/${projectId}/role/10618`)
            .reply(200, adminsProject);
    });

    afterEach(async () => {
        nock.cleanAll();
        await cleanRedis();
    });

    // TODO set readable test case names
    it('Permition denided for not admin in projects', async () => {
        const post = translate('notAdmin', { sender: 'notAdmin' });
        const result = await commandHandler({ ...baseOptions, sender: 'notAdmin' });
        expect(result).to.be.eq(post);
    });

    it('Success add key admin (not lead)', async () => {
        const post = translate('ignoreKeyAdded', { projectKey, typeTaskFromUser: issueType });
        const result = await commandHandler({ ...baseOptions, bodyText: `add ${issueType}`, sender: 'ii_ivanov' });
        expect(result).to.be.eq(post);
    });
});
