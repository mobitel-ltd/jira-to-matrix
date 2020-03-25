const nock = require('nock');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);
const translate = require('../../src/locales');
const testUtils = require('../test-utils');
const newgenProject = require('../fixtures/jira-api-requests/project-gens/new-gen/correct.json');
const { getArchiveProject } = require('../../src/bot/settings');

const commandHandler = require('../../src/bot/timeline-handler');
const utils = require('../../src/lib/utils');

describe('command project archive test', () => {
    let chatApi;
    let baseOptions;
    const bodyText = 'BBCOM';
    const sender = 'user';
    const roomId = 'roomId';
    const roomName = 'BBCOM-123';
    const commandName = 'project-archive';

    beforeEach(() => {
        chatApi = testUtils.getChatApi();
        baseOptions = { roomId, roomName, commandName, sender, chatApi, bodyText };
        nock(utils.getRestUrl())
            .get(`/project/${bodyText}`)
            .reply(200, newgenProject);
    });

    afterEach(async () => {
        nock.cleanAll();
        await testUtils.cleanRedis();
    });

    it('Expect archive save project key to queue if all is OK', async () => {
        const result = await commandHandler(baseOptions);
        const expected = translate('successProjectAddToArchive', { projectKey: bodyText });
        expect(result).to.be.eq(expected);
        expect(await getArchiveProject()).to.includes(bodyText);
    });

    it('Expect archive not save project key to queue if body text is empty', async () => {
        const result = await commandHandler({ ...baseOptions, bodyText: null });
        const expected = translate('emptyProject');

        expect(result).to.be.eq(expected);
        expect(await getArchiveProject()).not.to.includes(bodyText);
    });
});
