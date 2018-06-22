const nock = require('nock');
const {auth} = require('../../src/lib/utils.js');
const {BASE_URL} = require('../../src/matrix/timeline-handler/commands/helper.js');
const {schemaMove} = require('../../src/matrix/timeline-handler/commands/schemas.js');
const {move} = require('../../src/matrix/timeline-handler/commands');
const responce = require('../fixtures/transitions.json');
const {getRequestErrorLog} = require('../../src/lib/request');
const translate = require('../../src/locales');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('move test', () => {
    const roomName = 'BBCOM-123';
    const room = {roomId: 12345};
    const sendHtmlMessageStub = stub();

    const matrixClient = {
        sendHtmlMessage: sendHtmlMessageStub,
    };

    const errorStatus = 404;
    const urlPath = `/${roomName}/transitions`;

    before(() => {
        nock(BASE_URL, {
            reqheaders: {
                Authorization: auth(),
            },
        })
            .get(`/fake/transitions`)
            .reply(404, 'Error!!!')
            .get(urlPath)
            .times(2)
            .reply(200, responce)
            .post(urlPath, schemaMove('2'))
            .reply(204)
            .post(urlPath, schemaMove('5'))
            .reply(errorStatus);
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
        const fakeRoom = 'fake';
        const fakeUrl = `${BASE_URL}/${fakeRoom}/transitions`;
        const requestErrorLog = getRequestErrorLog(fakeUrl, errorStatus);
        const post = translate('errorMoveJira');
        const expectedData = [
            room.roomId,
            requestErrorLog,
            post,
        ];

        const result = await move({bodyText: '1', room, roomName: fakeRoom, matrixClient});
        const expected = `Issue ${fakeRoom} not changed status`;
        expect(result).to.be.equal(expected);
        expect(sendHtmlMessageStub).have.to.been.calledWithExactly(...expectedData);
        sendHtmlMessageStub.reset();
    });
});
