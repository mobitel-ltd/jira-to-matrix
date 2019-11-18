const { random } = require('faker');
const { cleanRedis } = require('../test-utils');
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

const commandHandler = require('../../src/bot/timeline-handler');
const utils = require('../../src/lib/utils');

describe('Ignore setting for projects', () => {
    let chatApi;
    const roomName = `${jiraProject.key}-123`;
    const projectKey = jiraProject.key;
    const projectId = jiraProject.id;
    const sender = jiraProject.lead.name;
    const roomId = random.number();
    const commandName = 'ignore';
    const bodyText = '';
    const { issueTypes } = jiraProject;
    let baseOptions;
    const projectIssueTypes = issueTypes.map(item => item.name);
    let issueType;
    let anotherTaskName;
    const notUsedIssueTypes = random.word();
    const notExistedCommand = random.word();

    beforeEach(() => {
        // await redis.setAsync(utils.REDIS_IGNORE_PREFIX, JSON.stringify({[projectKey]: {}}));
        chatApi = testUtils.getChatApi();
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
        const post = translate('emptyIgnoreList', { projectKey });
        const result = await commandHandler(baseOptions);
        expect(result).to.be.eq(post);
    });

    it('Exist command and empty key', async () => {
        const post = translate('notIgnoreKey', { projectKey });
        const result = await commandHandler({ ...baseOptions, bodyText: 'add' });
        expect(result).to.be.eq(post);
    });

    it('Exist command and key not in project', async () => {
        const post = utils.ignoreKeysInProject(projectKey, projectIssueTypes);
        const result = await commandHandler({ ...baseOptions, bodyText: `add ${notUsedIssueTypes}` });
        expect(result).to.be.eq(post);
    });

    it('Success add key', async () => {
        const post = translate('ignoreKeyAdded', { projectKey, typeTaskFromUser: issueType });
        const result = await commandHandler({ ...baseOptions, bodyText: `add ${issueType}` });
        expect(result).to.be.eq(post);
    });

    it('Success add key admin (not lead)', async () => {
        const post = translate('ignoreKeyAdded', { projectKey, typeTaskFromUser: issueType });
        const result = await commandHandler({ ...baseOptions, bodyText: `add ${issueType}`, sender: 'ii_ivanov' });
        expect(result).to.be.eq(post);
    });

    it('Command not found', async () => {
        const post = translate('commandNotFound');
        const result = await commandHandler({ ...baseOptions, bodyText: `${notExistedCommand} ${issueType}` });
        expect(result).to.be.eq(post);
    });

    describe('test', () => {
        beforeEach(async () => {
            await redis.setAsync(
                utils.REDIS_IGNORE_PREFIX,
                JSON.stringify({ [projectKey]: { taskType: [issueType] } }),
            );
        });
        it('Delete key, not in ignore list', async () => {
            const post = translate('keyNotFoundForDelete', { projectKey });
            const result = await commandHandler({ ...baseOptions, bodyText: `del ${anotherTaskName}` });
            expect(result).to.be.eq(post);
        });

        it('Success delete key', async () => {
            const post = translate('ignoreKeyDeleted', { projectKey, typeTaskFromUser: issueType });
            const result = await commandHandler({ ...baseOptions, bodyText: `del ${issueType}` });
            expect(result).to.be.eq(post);
        });

        it('Add key, such already added', async () => {
            const post = translate('keyAlreadyExistForAdd', { typeTaskFromUser: issueType, projectKey });
            const result = await commandHandler({ ...baseOptions, bodyText: `add ${issueType}` });
            expect(result).to.be.eq(post);
        });

        it('Expect empty body - full list', async () => {
            const post = utils.getIgnoreTips(projectKey, [issueType]);
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
