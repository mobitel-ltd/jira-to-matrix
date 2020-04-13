const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const schemas = require('../../src/lib/schemas.js');
const translate = require('../../src/locales');
const edimetaJSON = require('../fixtures/jira-api-requests/editmeta.json');
const commandHandler = require('../../src/bot/commands');

const chai = require('chai');
const { stub } = require('sinon');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);

describe('Prio command test', () => {
    const allPriorities = edimetaJSON.fields.priority.allowedValues;
    const [priority] = allPriorities;
    const roomId = 12345;

    const chatApi = {
        sendHtmlMessage: stub(),
    };

    const roomName = 'BBCOM-123';

    const commandName = 'prio';

    const baseOptions = { roomId, roomName, commandName, chatApi };

    before(() => {
        nock(utils.getRestUrl())
            .get(`/issue/${roomName}/editmeta`)
            .times(5)
            .reply(200, edimetaJSON)
            .put(`/issue/${roomName}`, schemas.fields(priority.id))
            .times(2)
            .reply(201);
    });

    afterEach(() => {
        Object.values(chatApi).map(val => val.resetHistory());
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect prio show all priorities with empty body ("!prio")', async () => {
        const post = utils.getCommandList(allPriorities);
        const result = await commandHandler({ ...baseOptions });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('Expect prio command work correct ("!prio 1")', async () => {
        const post = translate('setPriority', priority);
        const result = await commandHandler({ ...baseOptions, bodyText: priority.id });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('Expect prio command work correct with word command even in upper case("!prio HIGHEST")', async () => {
        const post = translate('setPriority', priority);
        const result = await commandHandler({ ...baseOptions, bodyText: priority.name.toUpperCase() });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('Expect prio command send message about not found command ("!prio fake")', async () => {
        const bodyText = 'fake';
        const post = translate('notFoundPrio', { bodyText });
        const result = await commandHandler({ ...baseOptions, bodyText });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });
});
