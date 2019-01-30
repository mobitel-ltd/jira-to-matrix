const nock = require('nock');
const schemas = require('../../src/lib/schemas');
const {move} = require('../../src/matrix/timeline-handler/commands');
const transitionsJSON = require('../fixtures/jira-api-requests/transitions.json');
const translate = require('../../src/locales');
const messages = require('../../src/lib/messages');
const utils = require('../../src/lib/utils');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('move test', () => {
    const sender = 'jira_test';
    const roomName = 'BBCOM-123';
    const room = {roomId: 12345};
    const {transitions} = transitionsJSON;
    const [newStatus] = transitions;

    const matrixClient = {sendHtmlMessage: stub()};

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
        Object.values(matrixClient).map(val => val.resetHistory());
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect commands with empty body will list statuses ("!move")', async () => {
        const body = utils.getCommandList(transitions);
        const result = await move({room, roomName, matrixClient});

        expect(matrixClient.sendHtmlMessage).have.to.been.calledWithExactly(room.roomId, body, body);
        expect(result).to.be.undefined;
    });

    it('Expect correct !move command', async () => {
        const body = translate('successMoveJira', {...newStatus, sender});
        const result = await move({bodyText: newStatus.id, room, roomName, sender, matrixClient});

        expect(matrixClient.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, body, body);
        expect(result).to.be.equal(messages.getMoveSuccessLog(roomName));
    });

    it('Expect correct !move command with upper case body', async () => {
        const body = translate('successMoveJira', {...newStatus, sender});
        const result = await move({bodyText: newStatus.name.toUpperCase(), room, sender, roomName, matrixClient});

        expect(matrixClient.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, body, body);
        expect(result).to.be.equal(messages.getMoveSuccessLog(roomName));
    });

    it('Expect move command send message about not found command ("!move fake")', async () => {
        const bodyText = 'fake';
        const post = translate('notFoundMove', {bodyText});
        const result = await move({bodyText, room, roomName, matrixClient});

        expect(result).to.be.eq(messages.getNotFoundMoveCommandLog(roomName, bodyText));
        expect(matrixClient.sendHtmlMessage).to.have.been.calledWithExactly(room.roomId, post, post);
    });

    it('Expect error to be thrown with tag', async () => {
        let res;
        try {
            await move({bodyText: '1', room, roomName: 'fakeRoom', matrixClient});
        } catch (err) {
            res = err;
        }

        expect(res).to.be.include('Matrix Move command');
    });
});
