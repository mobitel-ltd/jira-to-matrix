const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const schemas = require('../../src/lib/schemas.js');
const translate = require('../../src/locales');
const messages = require('../../src/lib/messages');
const edimetaJSON = require('../fixtures/jira-api-requests/editmeta.json');
const {prio} = require('../../src/bot/timeline-handler/commands');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('Prio command test', () => {
    const allPriorities = edimetaJSON.fields.priority.allowedValues;
    const [priority] = allPriorities;
    const room = {roomId: 12345};

    const chatApi = {
        sendHtmlMessage: stub(),
    };

    const roomName = 'BBCOM-123';

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

    it('Expect prio command work correct ("!prio 1")', async () => {
        const post = translate('setPriority', priority);
        const result = await prio({bodyText: priority.id, room, roomName, chatApi});

        expect(result).to.be.equal(messages.getUpdatedIssuePriorityLog(roomName, priority.name));
        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, post, post);
    });

    it('Expect prio command work correct with word command even in upper case("!prio HIGHEST")', async () => {
        const post = translate('setPriority', priority);
        const result = await prio({bodyText: priority.name.toUpperCase(), room, roomName, chatApi});

        expect(result).to.be.equal(messages.getUpdatedIssuePriorityLog(roomName, priority.name));
        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, post, post);
    });

    it('Expect prio show all priorities with empty body ("!prio")', async () => {
        const post = utils.getCommandList(allPriorities);
        const result = await prio({room, roomName, chatApi});

        expect(result).to.be.undefined;
        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, post, post);
    });

    it('Expect prio command send message about not found command ("!prio fake")', async () => {
        const bodyText = 'fake';
        const post = translate('notFoundPrio', {bodyText});
        const result = await prio({bodyText, room, roomName, chatApi});

        expect(result).to.be.eq(messages.getNotFoundPrioCommandLog(roomName, bodyText));
        expect(chatApi.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, post, post);
    });

    it('Expect error to be thrown with tag', async () => {
        const error = 'Error';
        chatApi.sendHtmlMessage.throws(error);
        let res;
        try {
            await prio({room, roomName, chatApi});
        } catch (err) {
            res = err;
        }
        expect(res).to.include(utils.errorTracing('Matrix prio command'), error);
    });
});
