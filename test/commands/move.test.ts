import * as R from 'ramda';
import nock from 'nock';
const schemas from '../../src/lib/schemas');
const transitionsJSON from '../fixtures/jira-api-requests/transitions.json');
import { translate } from '../../src/locales';
const utils from '../../src/lib/utils');
const commandHandler from '../../src/bot/commands');

import * as chai from 'chai';
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';
const { expect } = chai;
chai.use(sinonChai);

describe('move test', () => {
    const sender = 'jira_test';
    const roomName = 'BBCOM-123';
    const roomId = 12345;
    const { transitions } = transitionsJSON;
    const newStatus = R.head(transitions);
    const lastStatus = R.last(transitions);

    const chatApi = { sendHtmlMessage: stub() };

    const commandName = 'move';

    const baseOptions = { roomId, roomName, commandName, chatApi, sender };

    beforeEach(() => {
        nock(utils.getRestUrl())
            .get(`/issue/${roomName}/transitions`)
            .reply(200, transitionsJSON)
            .post(`/issue/${roomName}/transitions`, schemas.move(newStatus.id))
            .reply(204)
            .post(`/issue/${roomName}/transitions`, schemas.move(lastStatus.id))
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

        expect(body.includes(1)).to.be.true;
        expect(body.includes(transitions.length)).to.be.true;
        expect(result).to.be.eq(body);
        expect(chatSingle.sendHtmlMessage).have.to.been.calledWithExactly(roomId, body, body);
    });

    it('Expect correct !move command with upper case body', async () => {
        const body = translate('successMoveJira', { name: newStatus.name, sender });
        const result = await commandHandler({ ...baseOptions, bodyText: newStatus.name.toUpperCase() });

        expect(chatSingle.sendHtmlMessage).to.have.been.calledWithExactly(roomId, body, body);
        expect(result).to.be.equal(body);
    });

    it('Expect correct !move command with status "to.name" in upper case body ', async () => {
        const body = translate('successMoveJira', { name: newStatus.name, sender });
        const result = await commandHandler({ ...baseOptions, bodyText: newStatus.to.name.toUpperCase() });

        expect(chatSingle.sendHtmlMessage).to.have.been.calledWithExactly(roomId, body, body);
        expect(result).to.be.equal(body);
    });

    it('Expect correct !move command with numeric argument (!move 2)', async () => {
        const body = translate('successMoveJira', { name: lastStatus.name, sender });
        const result = await commandHandler({ ...baseOptions, bodyText: `${transitions.length}` });

        expect(chatSingle.sendHtmlMessage).to.have.been.calledWithExactly(roomId, body, body);
        expect(result).to.be.equal(body);
    });

    it('Expect move command send message about not found command with 0 as argument ("!move 0")', async () => {
        const bodyText = '0';
        const post = translate('notFoundMove', { bodyText });
        const result = await commandHandler({ ...baseOptions, bodyText });

        expect(result).to.be.eq(post);
        expect(chatSingle.sendHtmlMessage).to.have.been.calledWithExactly(roomId, post, post);
    });

    it('Expect move command send message about not found command ("!move fake")', async () => {
        const bodyText = 'fake';
        const post = translate('notFoundMove', { bodyText });
        const result = await commandHandler({ ...baseOptions, bodyText });

        expect(result).to.be.eq(post);
        expect(chatSingle.sendHtmlMessage).to.have.been.calledWithExactly(roomId, post, post);
    });
});
