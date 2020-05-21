const { matrix } from '../fixtures/messenger-settings');
import { config } from '../../src/config';
import nock from 'nock';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
const { expect } = chai;
chai.use(sinonChai);
import { translate } from '../../src/locales';
const testUtils from '../test-utils');
const newgenProject from '../fixtures/jira-api-requests/project-gens/new-gen/correct.json');
const { getArchiveProject } from '../../src/bot/settings');
const {
    LAST_ACTIVE_OPTION,
    DEFAULT_MONTH,
    STATUS_OPTION,
} from '../../src/bot/commands/command-list/archive-project');
const transitionsJSON from '../fixtures/jira-api-requests/transitions.json');
const searchProject from '../fixtures/jira-api-requests/project-gens/search-project.json');

const commandHandler from '../../src/bot/commands');
const utils from '../../src/lib/utils');

describe('command project archive test', () => {
    let chatApi;
    let baseOptions;
    const bodyText = 'BBCOM';
    const sender = 'user';
    const roomId = 'roomId';
    const roomName = 'BBCOM-123';
    const commandName = 'projectarchive';
    const lastStatusName = transitionsJSON.transitions[1].to.name;

    beforeEach(() => {
        const matrixMessengerDataWithRoom = { ...matrix, infoRoom: { name: roomName }, isMaster: true };
        const roomData = { alias: roomName };
        const configWithInfo = { ...defaultConfig, messenger: matrixMessengerDataWithRoom };

        chatApi = testUtils.getChatClass({ config: configWithInfo });
        baseOptions = { roomId, roomData, commandName, sender, chatApi, bodyText, config: configWithInfo };
        const lastIssueKey = searchProject.issues[0].key;
        nock(utils.getRestUrl())
            .get(`/search?jql=project=${bodyText}`)
            .reply(200, searchProject)
            .get(`/issue/${lastIssueKey}/transitions`)
            .reply(200, transitionsJSON)
            .get(`/project/${bodyText}`)
            .reply(200, newgenProject);
    });

    afterEach(async () => {
        nock.cleanAll();
        await testUtils.cleanRedis();
    });

    it('Expect archiveproject return ignoreCommand message if command is ignore list', async () => {
        const result = await commandHandler({
            ...baseOptions,
            bodyText: 'olololo',
            config: { ignoreCommands: [commandName] },
        });

        expect(result).to.be.eq(translate('ignoreCommand', { commandName }));
        expect(await getArchiveProject()).to.be.empty;
    });

    it('Expect archive return issueNotExistOrPermDen message if no jira project exists', async () => {
        const result = await commandHandler({ ...baseOptions, bodyText: 'olololo' });

        expect(result).to.be.eq(translate('issueNotExistOrPermDen'));
        expect(await getArchiveProject()).to.be.empty;
    });

    it('Expect archive save project key to queue if all is OK', async () => {
        const result = await commandHandler(baseOptions);
        const expected = translate('successProjectAddToArchive', { projectKey: bodyText, activeTime: DEFAULT_MONTH });
        expect(result).to.be.eq(expected);
        const [data] = await getArchiveProject();
        expect(data).to.includes(bodyText);
    });

    it('Expect archive not save project key to queue if body text is empty', async () => {
        const result = await commandHandler({ ...baseOptions, bodyText: null });
        const expected = translate('emptyProject');

        expect(result).to.be.eq(expected);
        expect(await getArchiveProject()).not.to.includes(bodyText);
    });

    it('expect return unknownArgs message if body text have multiple unexpected words', async () => {
        const text = 'lallaal oooo -labc';
        const result = await commandHandler({
            ...baseOptions,
            bodyText: [`--${LAST_ACTIVE_OPTION}`, text].join(' '),
        });
        expect(result).to.be.eq(translate('unknownArgs', { unknownArgs: text.split(' ') }));
    });

    it('Expect archive return warning message if body month is not valid', async () => {
        const failedMonth = 'lallalalla';
        const body = `--${LAST_ACTIVE_OPTION}    ${failedMonth}`;
        const result = await commandHandler({ ...baseOptions, bodyText: `${bodyText} ${body}` });
        const expected = translate('notValid', { body: failedMonth });

        expect(result).to.be.eq(expected);
        expect(await getArchiveProject()).to.be.empty;
    });

    it('Expect archive return succcess message if command with limit time options is coorectly added', async () => {
        const activeTime = 1;
        const body = `--${LAST_ACTIVE_OPTION}    ${activeTime}`;
        const result = await commandHandler({ ...baseOptions, bodyText: `${bodyText} ${body}` });
        const expected = translate('successProjectAddToArchive', { projectKey: bodyText, activeTime });

        expect(result).to.be.eq(expected);
        const [data] = await getArchiveProject();
        expect(data).to.includes(bodyText);
    });

    it('Expect archive return succcess message if command with limit time options is coorectly added', async () => {
        const body = `--${STATUS_OPTION}    ${lastStatusName}`;
        const result = await commandHandler({ ...baseOptions, bodyText: `${bodyText} ${body}` });
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
        const result = await commandHandler({ ...baseOptions, bodyText: `${bodyText} ${body}` });
        const expected = translate('notValid', { body: fakeStatus });

        expect(result).to.be.eq(expected);
        expect(await getArchiveProject()).to.be.empty;
    });

    it('Expect return error message if room is not command', async () => {
        const result = await commandHandler({ ...baseOptions, roomData: { alias: 'some other room' } });

        expect(result).to.be.eq(translate('notCommandRoom'));
    });

    it('Expect return nothing if bot is not master', async () => {
        chatSingle.isMaster = () => false;
        const result = await commandHandler(baseOptions);

        expect(result).to.be.undefined;
    });
});
