const commandHandler = require('../../src/bot/timeline-handler');
const translate = require('../../src/locales');
// const utils = require('../../src/lib/utils');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('invite test', () => {
    const inviteRoomId = 'someID';
    const roomId = 12345;

    const chatApi = {
        invite: stub(),
        getRoomIdByName: stub(),
        sendHtmlMessage: stub(),
    };

    const bodyText = 'BBCOM-123';
    const sender = 'jira_test';
    // const senderMatrixId = utils.getChatUserId(sender);
    const alias = `#${bodyText.toUpperCase()}@matrix.test-example.ru`;
    const commandName = 'invite';

    const baseOptions = {roomId, bodyText, commandName, sender, chatApi};

    beforeEach(() => {
        chatApi.getRoomIdByName.resolves(inviteRoomId);
    });

    afterEach(() => {
        Object.values(chatApi).map(val => val.reset());
    });

    it('Expect invite successfully', async () => {
        const body = translate('successMatrixInvite', {sender, roomName: bodyText});
        const result = await commandHandler(baseOptions);

        expect(result).to.be.eq(body);
        // expect(chatApi.getRoomId).have.to.been.calledWithExactly(alias);
        // expect(chatApi.invite).have.to.been.calledWithExactly(inviteRoomId, senderMatrixId);
        // expect(chatApi.sendHtmlMessage).have.to.been.calledWithExactly(roomId, body, body);
    });

    it('Expect invite to room with domain', async () => {
        const body = translate('successMatrixInvite', {sender, roomName: alias});
        const result = await commandHandler({...baseOptions, bodyText: alias});

        expect(result).to.be.eq(body);
        // expect(chatApi.getRoomId).have.to.been.calledWithExactly(alias);
        // expect(chatApi.invite).have.to.been.calledWithExactly(inviteRoomId, senderMatrixId);
        // expect(chatApi.sendHtmlMessage).have.to.been.calledWithExactly(roomId, body, body);
    });

    it('Expect invite to not found room return no found warn', async () => {
        chatApi.getRoomIdByName.throws('Error!!!');
        const body = translate('notFoundRoom', {roomName: bodyText});
        const result = await commandHandler(baseOptions);

        expect(result).to.be.eq(body);
        // expect(chatApi.getRoomId).to.have.been.thrown;
        // expect(chatApi.invite).not.to.have.been.called;
        // expect(chatApi.sendHtmlMessage).have.to.been.calledWithExactly(roomId, body, body);
    });

    it('Expect invite not admin user return no permission warn', async () => {
        const noAdminUser = 'fedor';
        const body = translate('notAdmin', {sender: noAdminUser});
        const result = await commandHandler({...baseOptions, sender: noAdminUser});

        expect(result).to.be.eq(body);
        // expect(chatApi.getRoomId).not.to.have.been.called;
        // expect(chatApi.invite).not.to.have.been.called;
        // expect(chatApi.sendHtmlMessage).have.to.been.calledWithExactly(roomId, body, body);
    });

    it('Expect some other error to be not handled', async () => {
        chatApi.invite.throws('Error!!!');
        let res;
        try {
            await commandHandler(baseOptions);
        } catch (err) {
            res = err;
        }

        expect(res).to.include('Matrix Invite command');
    });
});
