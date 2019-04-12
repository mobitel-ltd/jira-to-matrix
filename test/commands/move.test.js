const nock = require('nock');
const schemas = require('../../src/lib/schemas');
const transitionsJSON = require('../fixtures/jira-api-requests/transitions.json');
const translate = require('../../src/locales');
const utils = require('../../src/lib/utils');
const commandHandler = require('../../src/bot/timeline-handler');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('move test', () => {
    const sender = 'jira_test';
    const roomName = 'BBCOM-123';
    const roomId = 12345;
    const {transitions} = transitionsJSON;
    const [newStatus] = transitions;

    const chatApi = {sendHtmlMessage: stub()};

    const commandName = 'move';

    const baseOptions = {roomId, roomName, commandName, chatApi, sender};

    before(() => {
        nock(utils.getRestUrl())
            .get(`/issue/${roomName}/transitions`)
            .times(4)
            .reply(200, transitionsJSON)
            .post(`/issue/${roomName}/transitions`, schemas.move('2'))
            .times(2)
            .reply(204)
            .post(`/issue/${roomName}/transitions`, schemas.move('5'))
            .reply(404);
    });

    afterEach(() => {
        Object.values(chatApi).map(val => val.resetHistory());
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect commands with empty body will list statuses ("!move")', async () => {
        const body = utils.getCommandList(transitions);
        const result = await commandHandler(baseOptions);

        expect(result).to.be.eq(body);
        expect(chatApi.sendHtmlMessage).have.to.been.calledWithExactly(roomId, body, body);
    });

    it('Expect correct !move command', async () => {
        const body = translate('successMoveJira', {...newStatus, sender});
        const result = await commandHandler({...baseOptions, bodyText: newStatus.id});

        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(roomId, body, body);
        expect(result).to.be.eq(body);
    });

    it('Expect correct !move command with upper case body', async () => {
        const body = translate('successMoveJira', {...newStatus, sender});
        const result = await commandHandler({...baseOptions, bodyText: newStatus.name.toUpperCase()});

        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(roomId, body, body);
        expect(result).to.be.equal(body);
    });

    it('Expect move command send message about not found command ("!move fake")', async () => {
        const bodyText = 'fake';
        const post = translate('notFoundMove', {bodyText});
        const result = await commandHandler({...baseOptions, bodyText});

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(roomId, post, post);
    });
});
