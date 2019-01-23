const nock = require('nock');
const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

const {BASE_URL} = require('../../src/matrix/timeline-handler/commands/helper.js');
const schemas = require('../../src/lib/schemas.js');
const {comment} = require('../../src/matrix/timeline-handler/commands');
const {getRequestErrorLog} = require('../../src/lib/messages');
const {dict: {errorMatrixComment}} = require('../../src/locales/ru.js');
const messages = require('../../src/lib/messages');

describe('comment test', () => {
    const sendHtmlMessageStub = stub();

    const matrixClient = {
        sendHtmlMessage: sendHtmlMessageStub,
    };
    const roomName = 'BBCOM-123';
    const bodyText = 'text in body';
    const sender = 'user';
    const room = {roomId: 12345};
    const errorStatus = 400;

    before(() => {
        nock(BASE_URL)
            .post(`/${roomName}/comment`, schemas.comment(sender, bodyText))
            .reply(201)
            .post(`/${roomName}/comment`)
            .reply(400);
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect comment to be sent', async () => {
        const result = await comment({bodyText, sender, room, roomName, matrixClient});
        expect(result).to.be.equal(messages.getCommentSuccessSentLog(sender, roomName));

        expect(sendHtmlMessageStub).not.to.have.been.called;

        sendHtmlMessageStub.reset();
    });

    it('comment not published', async () => {
        const sender = null;
        const body = schemas.comment(sender, bodyText);
        const requestErrorLog = getRequestErrorLog(`${BASE_URL}${`/${roomName}/comment`}`, errorStatus, {method: 'POST', body});

        const expected = [messages.getCommentFailSentLog(sender, roomName), requestErrorLog].join('\n');
        const expectedData = [
            room.roomId,
            errorMatrixComment,
            errorMatrixComment,
        ];

        const commentAnswer = await comment({bodyText, sender, room, roomName, matrixClient});
        expect(commentAnswer).to.be.equal(expected);

        expect(sendHtmlMessageStub).have.to.been.calledWithExactly(...expectedData);
        sendHtmlMessageStub.reset();
    });
});
