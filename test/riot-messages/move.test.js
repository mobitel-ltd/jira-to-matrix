const nock = require('nock');
const {auth} = require('../../src/jira/common');
const {BASE_URL} = require('../../src/matrix/timeline-handler/commands/helper.js');
const {schemaMove} = require('../../src/matrix/timeline-handler/commands/schemas.js');
const {move} = require('../../src/matrix/timeline-handler/commands');
const responce = require('../fixtures/transitions.json');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('move test', () => {
    const roomName = 'BBCOM-123';
    const room = {roomId: 12345};
    const sendHtmlMessageStub = stub().callsFake((roomId, body, htmlBody) => {});

    const matrixClient = {
        sendHtmlMessage: sendHtmlMessageStub,
    };

    before(() => {
        nock(BASE_URL, {
            reqheaders: {
                Authorization: auth(),
            },
        })
            .get(`/fake/transitions`)
            .reply(404, 'Error!!!')
            .get(`/${roomName}/transitions`)
            .times(2)
            .reply(200, responce)
            .post(`/${roomName}/transitions`, schemaMove('2'))
            .reply(204)
            .post(`/${roomName}/transitions`, schemaMove('5'))
            .reply(400);
    });

    it('Get correct !move list commands', async () => {
        const expectedData = [
            room.roomId,
            'list commands',
            '<b>Список доступных команд:</b><br>&nbsp;&nbsp;1)&nbsp;Close Issue<br>&nbsp;&nbsp;2)&nbsp;QA Review<br>',
        ];

        const result = await move({bodyText: '', room, roomName, matrixClient});
        expect(sendHtmlMessageStub).have.to.been.calledWithExactly(...expectedData);
        expect(result).to.be.undefined;
        sendHtmlMessageStub.reset();
    });

    it('Get correct !move command', async () => {
        const result = await move({bodyText: '1', room, roomName, matrixClient});

        const expected = `Issue ${roomName} changed status`;
        expect(sendHtmlMessageStub).not.to.have.been.called;
        expect(result).to.be.equal(expected);
        sendHtmlMessageStub.reset();
    });

    it('Get error', async () => {
        const expectedData = [
            room.roomId,
            'Error in request https://jira.bingo-boom.ru/jira/rest/api/2/issue/fake/transitions\nStatusCodeError: 404 - "Error!!!"',
            'ОШИБКА! Статус задачи не изменен<br>Попробуйте еще раз',
        ];

        const result = await move({bodyText: '1', room, roomName: 'fake', matrixClient});
        const expected = `Issue fake not changed status`;
        expect(result).to.be.equal(expected);
        expect(sendHtmlMessageStub).have.to.been.calledWithExactly(...expectedData);
        sendHtmlMessageStub.reset();

    });
});
