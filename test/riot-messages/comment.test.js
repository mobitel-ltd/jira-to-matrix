const nock = require('nock');
const {auth} = require('../../src/lib/utils.js');
const {BASE_URL} = require('../../src/matrix/timeline-handler/commands/helper.js');
const {schemaComment} = require('../../src/matrix/timeline-handler/commands/schemas.js');
const {comment} = require('../../src/matrix/timeline-handler/commands');
const {getRequestErrorLog} = require('../../src/lib/request');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('comment test', () => {
    const sendHtmlMessageStub = stub().callsFake((roomId, body, htmlBody) => {});

    const matrixClient = {
        sendHtmlMessage: sendHtmlMessageStub,
    };
    const roomName = 'BBCOM-123';
    const bodyText = 'text in body';
    const sender = 'Bot';
    const room = {roomId: 12345};
    const urlPath = `/${roomName}/comment`;
    const errorStatus = 400;

    before(() => {
        nock(BASE_URL, {
            reqheaders: {
                Authorization: auth(),
            },
        })
            .post(urlPath, schemaComment(sender, bodyText))
            .reply(201)
            .post(urlPath)
            .reply(errorStatus, 'Error!!!');
    });


    it('should comment', async () => {
        const expected = `Comment from ${sender} for ${roomName}`;

        const result = await comment({bodyText, sender, room, roomName, matrixClient});
        expect(result).to.be.equal(expected);

        expect(sendHtmlMessageStub).not.to.have.been.called;

        sendHtmlMessageStub.reset();
    });

    it('comment not published', async () => {
        const requestErrorLog = getRequestErrorLog(`${BASE_URL}${urlPath}`, errorStatus, 'POST');

        const expected = [`Comment from null for ${roomName} not published`, requestErrorLog].join('\n');
        const expectedData = [
            room.roomId,
            'Что-то пошло не так! Комментарий не опубликован',
            'Что-то пошло не так! Комментарий не опубликован',
        ];

        const commentAnswer = await comment({bodyText, sender: null, room, roomName, matrixClient});
        expect(commentAnswer).to.be.equal(expected);

        expect(sendHtmlMessageStub).have.to.been.calledWithExactly(...expectedData);
        sendHtmlMessageStub.reset();
    });
});
