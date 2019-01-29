const nock = require('nock');
const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);
const translate = require('../../src/locales');

const utils = require('../../src/lib/utils');
const schemas = require('../../src/lib/schemas.js');
const {comment} = require('../../src/matrix/timeline-handler/commands');
const messages = require('../../src/lib/messages');

describe('comment test', () => {
    const roomName = 'BBCOM-123';
    const bodyText = 'text in body';
    const sender = 'user';
    const room = {roomId: 12345};

    const matrixClient = {sendHtmlMessage: stub()};

    afterEach(() => {
        nock.cleanAll();
    });

    it('Expect comment to be sent', async () => {
        nock(utils.getRestUrl())
            .post(`/issue/${roomName}/comment`, schemas.comment(sender, bodyText))
            .reply(201);
        const result = await comment({bodyText, sender, roomName});
        expect(result).to.be.equal(messages.getCommentSuccessSentLog(sender, roomName));
    });

    it('Expect error to be thrown with tag', async () => {
        nock(utils.getRestUrl())
            .post(`/issue/${roomName}/comment`, schemas.comment(sender, bodyText))
            .reply(400);

        let res;
        try {
            await comment({bodyText, sender, roomName});
        } catch (err) {
            res = err;
        }

        expect(res).to.be.include('Matrix Comment command');
    });

    it('Expect comment not to be sent with empty body and warn message will be sent', async () => {
        const result = await comment({sender, roomName, room, matrixClient});

        expect(result).to.be.equal(messages.getCommentFailSentLog(sender, roomName));
        const body = translate('emptyMatrixComment');
        expect(matrixClient.sendHtmlMessage).to.be.calledWithExactly(room.roomId, body, body);
    });
});
