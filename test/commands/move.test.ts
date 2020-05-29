import * as R from 'ramda';
import nock from 'nock';
import transitionsJSON from '../fixtures/jira-api-requests/transitions.json';
import { translate } from '../../src/locales';
import * as utils from '../../src/lib/utils';
import { Commands } from '../../src/bot/commands';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { schemas } from '../../src/task-trackers/jira/schemas';
import { taskTracker, getChatClass } from '../test-utils';
import { CommandNames } from '../../src/types';
import { config } from '../../src/config';

const { expect } = chai;
chai.use(sinonChai);

describe('move test', () => {
    let chatApi;
    let baseOptions;
    const commands = new Commands(config, taskTracker);

    const commandName = CommandNames.Move;

    const sender = 'jira_test';
    const roomName = 'BBCOM-123';
    const roomId = 'getRoomId';
    const { transitions } = transitionsJSON;
    const newStatus = R.head(transitions);
    const lastStatus = R.last(transitions);

    beforeEach(() => {
        chatApi = getChatClass().chatApiSingle;

        nock(taskTracker.getRestUrl())
            .get(`/issue/${roomName}/transitions`)
            .reply(200, transitionsJSON)
            .post(`/issue/${roomName}/transitions`, schemas.move(newStatus!.id))
            .reply(204)
            .post(`/issue/${roomName}/transitions`, schemas.move(lastStatus!.id))
            .reply(204)
            .post(`/issue/${roomName}/transitions`, schemas.move('5'))
            .reply(404);
        baseOptions = { roomName, chatApi, sender, roomId };
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it('Expect commands with empty body will list statuses ("!move")', async () => {
        const body = utils.getCommandList(transitions);
        const result = await commands.run(commandName, baseOptions);

        expect(body.includes(1)).to.be.true;
        expect(body.includes(transitions.length)).to.be.true;
        expect(result).to.be.eq(body);
        expect(chatApi.sendHtmlMessage).have.to.been.calledWithExactly(roomId, body, body);
    });

    it('Expect correct !move command with upper case body', async () => {
        const body = translate('successMoveJira', { name: newStatus!.name, sender });
        const result = await commands.run(commandName, { ...baseOptions, bodyText: newStatus!.name.toUpperCase() });

        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(roomId, body, body);
        expect(result).to.be.equal(body);
    });

    it('Expect correct !move command with status "to.name" in upper case body ', async () => {
        const body = translate('successMoveJira', { name: newStatus!.name, sender });
        const result = await commands.run(commandName, { ...baseOptions, bodyText: newStatus!.to.name.toUpperCase() });

        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(roomId, body, body);
        expect(result).to.be.equal(body);
    });

    it('Expect correct !move command with numeric argument (!move 2)', async () => {
        const body = translate('successMoveJira', { name: lastStatus!.name, sender });
        const result = await commands.run(commandName, { ...baseOptions, bodyText: `${transitions.length}` });

        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(roomId, body, body);
        expect(result).to.be.equal(body);
    });

    it('Expect move command send message about not found command with 0 as argument ("!move 0")', async () => {
        const bodyText = '0';
        const post = translate('notFoundMove', { bodyText });
        const result = await commands.run(commandName, { ...baseOptions, bodyText });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(roomId, post, post);
    });

    it('Expect move command send message about not found command ("!move fake")', async () => {
        const bodyText = 'fake';
        const post = translate('notFoundMove', { bodyText });
        const result = await commands.run(commandName, { ...baseOptions, bodyText });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(roomId, post, post);
    });
});
