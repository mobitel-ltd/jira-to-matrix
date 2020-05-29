import { random } from 'faker';
import nock from 'nock';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { translate } from '../../src/locales';
import { redis, REDIS_IGNORE_PREFIX } from '../../src/redis-client';
import { getChatClass, taskTracker, getUserIdByDisplayName, cleanRedis, getRoomId } from '../test-utils';
import jiraProject from '../fixtures/jira-api-requests/project-gens/classic/correct.json';
import jiraProjectNewGen from '../fixtures/jira-api-requests/project-gens/new-gen/correct.json';
import adminsProject from '../fixtures/jira-api-requests/project-gens/admins-project.json';
import * as utils from '../../src/lib/utils';
import { Commands } from '../../src/bot/commands';
import { config } from '../../src/config';
import { CommandNames } from '../../src/types';

const { expect } = chai;
chai.use(sinonChai);

describe('Ignore setting for projects', () => {
    let chatApi;
    const roomName = `${jiraProject.key}-123`;
    const projectKey = jiraProject.key;
    const projectId = jiraProject.id;
    const sender = getUserIdByDisplayName(jiraProject.lead.displayName);
    const roomId = getRoomId();
    const bodyText = '';
    const { issueTypes } = jiraProject;
    let baseOptions;
    let commands: Commands;

    const commandName = CommandNames.Ignore;
    const projectIssueTypes = issueTypes.map(item => item.name);
    let issueType;
    let anotherTaskName;
    const notUsedIssueTypes = random.word();
    const notExistedCommand = random.word();

    beforeEach(() => {
        // await redis.setAsync(REDIS_IGNORE_PREFIX, JSON.stringify({[projectKey]: {}}));
        chatApi = getChatClass().chatApiSingle;
        commands = new Commands(config, taskTracker);
        baseOptions = { roomId, roomName, sender, chatApi, bodyText };
        issueType = random.arrayElement(projectIssueTypes);
        anotherTaskName = projectIssueTypes.find(item => item !== issueType);
        nock(taskTracker.getRestUrl())
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
        const result = await commands.run(commandName, { ...baseOptions, sender: 'notAdmin' });
        expect(result).to.be.eq(post);
    });

    it('Expect empty body - empty list', async () => {
        const post = translate('emptySettingsList', { projectKey });
        const result = await commands.run(commandName, baseOptions);
        expect(result).to.be.eq(post);
    });

    it('Exist command and empty key', async () => {
        const post = translate('notIgnoreKey', { projectKey });
        const result = await commands.run(commandName, { ...baseOptions, bodyText: 'add' });
        expect(result).to.be.eq(post);
    });

    it('Exist command and key not in project', async () => {
        const post = utils.ignoreKeysInProject(projectKey, projectIssueTypes);
        const result = await commands.run(commandName, { ...baseOptions, bodyText: `add ${notUsedIssueTypes}` });
        expect(result).to.be.eq(post);
    });

    it('Success add key', async () => {
        const post = translate('ignoreKeyAdded', { projectKey, typeTaskFromUser: issueType });
        const result = await commands.run(commandName, { ...baseOptions, bodyText: `add ${issueType}` });
        expect(result).to.be.eq(post);
    });

    it('Success add key admin (not lead)', async () => {
        const post = translate('ignoreKeyAdded', { projectKey, typeTaskFromUser: issueType });
        const result = await commands.run(commandName, {
            ...baseOptions,
            bodyText: `add ${issueType}`,
            sender: getUserIdByDisplayName(adminsProject.actors[0].displayName),
        });
        expect(result).to.be.eq(post);
    });

    it('Command not found', async () => {
        const post = translate('commandNotFound');
        const result = await commands.run(commandName, {
            ...baseOptions,
            bodyText: `${notExistedCommand} ${issueType}`,
        });
        expect(result).to.be.eq(post);
    });

    describe('test', () => {
        beforeEach(async () => {
            await redis.setAsync(REDIS_IGNORE_PREFIX, JSON.stringify({ [projectKey]: { taskType: [issueType] } }));
        });
        it('Delete key, not in ignore list', async () => {
            const post = translate('keyNotFoundForDelete', { projectKey });
            const result = await commands.run(commandName, { ...baseOptions, bodyText: `del ${anotherTaskName}` });
            expect(result).to.be.eq(post);
        });

        it('Success delete key', async () => {
            const post = translate('ignoreKeyDeleted', { projectKey, typeTaskFromUser: issueType });
            const result = await commands.run(commandName, { ...baseOptions, bodyText: `del ${issueType}` });
            expect(result).to.be.eq(post);
        });

        it('Add key, such already added', async () => {
            const post = translate('keyAlreadyExistForAdd', { typeTaskFromUser: issueType, projectKey });
            const result = await commands.run(commandName, { ...baseOptions, bodyText: `add ${issueType}` });
            expect(result).to.be.eq(post);
        });

        it('Expect empty body - full list', async () => {
            const post = utils.getIgnoreTips(projectKey, [issueType], 'ignore');
            const result = await commands.run(commandName, baseOptions);
            expect(result).to.be.eq(post);
        });
    });
});

describe('Ignore setting for projects, check admins for next-gen projects', () => {
    let chatApi;
    const roomName = `${jiraProjectNewGen.key}-123`;
    const projectKey = jiraProjectNewGen.key;
    const projectId = jiraProjectNewGen.id;
    const sender = jiraProjectNewGen.lead.displayName;
    const roomId = getRoomId();
    const bodyText = '';
    const { issueTypes } = jiraProjectNewGen;
    let baseOptions;
    let commands: Commands;

    const commandName = CommandNames.Ignore;
    const projectIssueTypes = issueTypes.map(item => item.name);
    let issueType;

    beforeEach(() => {
        // await redis.setAsync(REDIS_IGNORE_PREFIX, JSON.stringify({[projectKey]: {}}));
        chatApi = getChatClass().chatApiSingle;
        commands = new Commands(config, taskTracker);
        baseOptions = { roomId, roomName, sender, chatApi, bodyText };
        issueType = random.arrayElement(projectIssueTypes);
        nock(taskTracker.getRestUrl())
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
        const result = await commands.run(commandName, { ...baseOptions, sender: 'notAdmin' });
        expect(result).to.be.eq(post);
    });

    it('Success add key admin (not lead)', async () => {
        const post = translate('ignoreKeyAdded', { projectKey, typeTaskFromUser: issueType });
        const result = await commands.run(commandName, {
            ...baseOptions,
            bodyText: `add ${issueType}`,
            sender: 'ii_ivanov',
        });
        expect(result).to.be.eq(post);
    });
});
