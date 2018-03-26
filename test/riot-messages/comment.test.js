const nock = require('nock');
const {auth} = require('../../src/jira/common');
const {BASE_URL} = require('../../src/matrix/timeline-handler/commands/helper.js');
const {schemaComment} = require('../../src/matrix/timeline-handler/commands/schemas.js');
const {comment} = require('../../src/matrix/timeline-handler/commands');

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

    before(() => {
        nock(BASE_URL, {
            reqheaders: {
                Authorization: auth(),
            },
        })
            .post(`/${roomName}/comment`, schemaComment(sender, bodyText))
            .reply(201)
            .post(`/${roomName}/comment`)
            .reply(400, 'Error!!!');
    });


    it('should comment', async () => {
        const expected = `Comment from ${sender} for ${roomName}`;

        const result = await comment({bodyText, sender, room, roomName, matrixClient});
        expect(result).to.be.equal(expected);

        expect(sendHtmlMessageStub).not.to.have.been.called;

        sendHtmlMessageStub.reset();
    });

    it('comment not published', async () => {
        const expected = `Comment from null for ${roomName} not published            POST Error while getting https://jira.bingo-boom.ru/jira/rest/api/2/issue/BBCOM-123/comment: StatusCodeError: 400 - "Error!!!"`;
        const expectedData = [
            room.roomId,
            'Что-то пошло не так! Комментарий не опубликован',
            'Что-то пошло не так! Комментарий не опубликован',
        ];

        const commentAnswer = await comment({bodyText, sender: null, room, roomName, matrixClient});
        const result = commentAnswer.replace(/(\r\n|\n|\r)/gm, '').trim();
        expect(result).to.be.equal(expected);

        expect(sendHtmlMessageStub).have.to.been.calledWithExactly(...expectedData);
        sendHtmlMessageStub.reset();
    });
});
