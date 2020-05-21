import nock from 'nock';
import * as utils from '../../src/lib/utils';
const schemas from '../../src/lib/schemas';
import { translate } from '../../src/locales';
const edimetaJSON from '../fixtures/jira-api-requests/editmeta.json');
const commandHandler from '../../src/bot/commands');

import * as chai from 'chai';
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';
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
        expect(chatSingle.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('Expect prio command work correct ("!prio 1")', async () => {
        const post = translate('setPriority', priority);
        const result = await commandHandler({ ...baseOptions, bodyText: priority.id });

        expect(result).to.be.eq(post);
        expect(chatSingle.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('Expect prio command work correct with word command even in upper case("!prio HIGHEST")', async () => {
        const post = translate('setPriority', priority);
        const result = await commandHandler({ ...baseOptions, bodyText: priority.name.toUpperCase() });

        expect(result).to.be.eq(post);
        expect(chatSingle.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });

    it('Expect prio command send message about not found command ("!prio fake")', async () => {
        const bodyText = 'fake';
        const post = translate('notFoundPrio', { bodyText });
        const result = await commandHandler({ ...baseOptions, bodyText });

        expect(result).to.be.eq(post);
        expect(chatSingle.sendHtmlMessage).to.have.been.calledOnceWithExactly(roomId, post, post);
    });
});
