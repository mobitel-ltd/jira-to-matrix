import { config } from '../../src/config';
import nock from 'nock';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { Commands } from '../../src/bot/commands';
import { translate } from '../../src/locales';
import { getChatClass, taskTracker, cleanRedis } from '../test-utils';
import newgenProject from '../fixtures/jira-api-requests/project-gens/new-gen/correct.json';
import { getArchiveProject } from '../../src/bot/settings';
import { LAST_ACTIVE_OPTION, DEFAULT_MONTH, STATUS_OPTION } from '../../src/bot/commands/command-list/archive-project';
import transitionsJSON from '../fixtures/jira-api-requests/transitions.json';
import searchProject from '../fixtures/jira-api-requests/project-gens/search-project.json';
import { Config, CommandNames } from '../../src/types';

chai.use(sinonChai);
const { expect } = chai;

describe('command project archive test', () => {
    let chatApi;
    let baseOptions;
    const bodyText = 'BBCOM';
    const sender = 'user';
    const roomId = 'roomId';
    const roomName = 'BBCOM-123';
    let commands: Commands;

    const commandName = CommandNames.Projectarchive;
    const lastStatusName = transitionsJSON.transitions[1].to.name;

    beforeEach(() => {
        const matrixMessengerDataWithRoom: Config['messenger'] = {
            ...config.messenger,
            infoRoom: { name: roomName },
        };
        const roomData = { alias: roomName };
        const configWithInfo: Config = { ...config, messenger: matrixMessengerDataWithRoom };

        chatApi = getChatClass({ config: configWithInfo }).chatApiSingle;
        commands = new Commands(configWithInfo, taskTracker);
        baseOptions = { roomName, commandName, chatApi };

        baseOptions = { roomId, roomData, sender, chatApi, bodyText };
        const lastIssueKey = searchProject.issues[0].key;
        nock(taskTracker.getRestUrl())
            .get(`/search?jql=project=${bodyText}`)
            .reply(200, searchProject)
            .get(`/issue/${lastIssueKey}/transitions`)
            .reply(200, transitionsJSON)
            .get(`/project/${bodyText}`)
            .reply(200, newgenProject);
    });

    afterEach(async () => {
        nock.cleanAll();
        await cleanRedis();
    });

    it('Expect archiveproject return ignoreCommand message if command is ignore list', async () => {
        const _commands = new Commands({ ...config, ignoreCommands: [commandName] }, taskTracker);

        const result = await _commands.run(commandName, {
            ...baseOptions,
            bodyText: 'olololo',
            config: { ignoreCommands: [commandName] },
        });

        expect(result).to.be.eq(translate('ignoreCommand', { commandName }));
        expect(await getArchiveProject()).to.be.empty;
    });

    it('Expect archive return issueNotExistOrPermDen message if no jira project exists', async () => {
        const result = await commands.run(commandName, { ...baseOptions, bodyText: 'olololo' });

        expect(result).to.be.eq(translate('issueNotExistOrPermDen'));
        expect(await getArchiveProject()).to.be.empty;
    });

    it('Expect archive save project key to queue if all is OK', async () => {
        const result = await commands.run(commandName, baseOptions);
        const expected = translate('successProjectAddToArchive', { projectKey: bodyText, activeTime: DEFAULT_MONTH });
        expect(result).to.be.eq(expected);
        const [data] = await getArchiveProject();
        expect(data).to.includes(bodyText);
    });

    it('Expect archive not save project key to queue if body text is empty', async () => {
        const result = await commands.run(commandName, { ...baseOptions, bodyText: null });
        const expected = translate('emptyProject');

        expect(result).to.be.eq(expected);
        expect(await getArchiveProject()).not.to.includes(bodyText);
    });

    it('expect return unknownArgs message if body text have multiple unexpected words', async () => {
        const text = 'lallaal oooo -labc';
        const result = await commands.run(commandName, {
            ...baseOptions,
            bodyText: [`--${LAST_ACTIVE_OPTION}`, text].join(' '),
        });
        expect(result).to.be.eq(translate('unknownArgs', { unknownArgs: text.split(' ') }));
    });

    it('Expect archive return warning message if body month is not valid', async () => {
        const failedMonth = 'lallalalla';
        const body = `--${LAST_ACTIVE_OPTION}    ${failedMonth}`;
        const result = await commands.run(commandName, { ...baseOptions, bodyText: `${bodyText} ${body}` });
        const expected = translate('notValid', { body: failedMonth });

        expect(result).to.be.eq(expected);
        expect(await getArchiveProject()).to.be.empty;
    });

    it('Expect archive return succcess message if command with limit time options is coorectly added', async () => {
        const activeTime = 1;
        const body = `--${LAST_ACTIVE_OPTION}    ${activeTime}`;
        const result = await commands.run(commandName, { ...baseOptions, bodyText: `${bodyText} ${body}` });
        const expected = translate('successProjectAddToArchive', { projectKey: bodyText, activeTime });

        expect(result).to.be.eq(expected);
        const [data] = await getArchiveProject();
        expect(data).to.includes(bodyText);
    });

    it('Expect archive return succcess message if command with limit time options is coorectly added last status', async () => {
        const body = `--${STATUS_OPTION}    ${lastStatusName}`;
        const result = await commands.run(commandName, { ...baseOptions, bodyText: `${bodyText} ${body}` });
        const expected = translate('successProjectAddToArchiveWithStatus', {
            projectKey: bodyText,
            activeTime: DEFAULT_MONTH,
            status: lastStatusName,
        });

        expect(result).to.be.eq(expected);
        const [data] = await getArchiveProject();
        expect(data).to.includes(bodyText);
        expect(data).to.includes(lastStatusName);
    });

    it('Expect archive return not correct jira status message if its not found in transitions', async () => {
        const fakeStatus = 'olololol';
        const body = `--${STATUS_OPTION}    ${fakeStatus}`;
        const result = await commands.run(commandName, { ...baseOptions, bodyText: `${bodyText} ${body}` });
        const expected = translate('notValid', { body: fakeStatus });

        expect(result).to.be.eq(expected);
        expect(await getArchiveProject()).to.be.empty;
    });

    it('Expect return error message if room is not command', async () => {
        const result = await commands.run(commandName, { ...baseOptions, roomData: { alias: 'some other room' } });

        expect(result).to.be.eq(translate('notCommandRoom'));
    });

    it('Expect return nothing if bot is not master', async () => {
        chatApi.isMaster = () => false;
        const result = await commands.run(commandName, baseOptions);

        expect(result).to.be.undefined;
    });
});
