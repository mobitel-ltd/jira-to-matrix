const nock = require('nock');
const schemas = require('../../src/lib/schemas');
const {move} = require('../../src/matrix/timeline-handler/commands');
const transitions = require('../fixtures/jira-api-requests/transitions.json');
const translate = require('../../src/locales');
const messages = require('../../src/lib/messages');
const utils = require('../../src/lib/utils');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('move test', () => {
    const roomName = 'BBCOM-123';
    const room = {roomId: 12345};

    const matrixClient = {sendHtmlMessage: stub()};

    before(() => {
        nock(utils.getRestUrl())
            .get(`/issue/${roomName}/transitions`)
            .times(2)
            .reply(200, transitions)
            .post(`/issue/${roomName}/transitions`, schemas.move('2'))
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

    it('Get correct !move list commands', async () => {
        const expectedData = [
            room.roomId,
            'list commands',
            '<b>Список доступных команд:</b><br>&nbsp;&nbsp;1)&nbsp;Close Issue<br>&nbsp;&nbsp;2)&nbsp;QA Review<br>',
        ];

        const result = await move({bodyText: '', room, roomName, matrixClient});
        expect(matrixClient.sendHtmlMessage).have.to.been.calledWithExactly(...expectedData);
        expect(result).to.be.undefined;
    });

    it('Get correct !move command', async () => {
        const result = await move({bodyText: '1', room, roomName, matrixClient});

        expect(matrixClient.sendHtmlMessage).not.to.have.been.called;
        expect(result).to.be.equal(messages.getMoveSuccessLog(roomName));
    });

    it('Get error', async () => {
        const result = await move({bodyText: '1', room, roomName: 'fakeRoom', matrixClient});

        const post = translate('errorMoveJira');
        expect(result).to.be.equal(post);
        expect(matrixClient.sendHtmlMessage).have.to.been.calledWithExactly(room.roomId, post, post);
    });
});
