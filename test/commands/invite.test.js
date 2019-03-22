const {invite} = require('../../src/bot/timeline-handler/commands');
const translate = require('../../src/locales');
const utils = require('../../src/lib/utils');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('invite test', () => {
    const room = {roomId: 12345};
    const inviteRoomId = 'someID';

    const chatApi = {
        invite: stub(),
        getRoomId: stub(),
        sendHtmlMessage: stub(),
    };

    const bodyText = 'BBCOM-123';
    const sender = 'jira_test';
    const senderMatrixId = utils.getChatUserId(sender);
    const alias = utils.getMatrixRoomAlias(bodyText.toUpperCase());

    beforeEach(() => {
        chatApi.getRoomId.resolves(inviteRoomId);
    });

    afterEach(() => {
        Object.values(chatApi).map(val => val.reset());
    });

    it('Expect invite successfully', async () => {
        const body = translate('successMatrixInvite', {sender, roomName: bodyText});

        await invite({bodyText, sender, room, chatApi});

        expect(chatApi.getRoomId).have.to.been.calledWithExactly(alias);
        expect(chatApi.invite).have.to.been.calledWithExactly(inviteRoomId, senderMatrixId);
        expect(chatApi.sendHtmlMessage).have.to.been.calledWithExactly(room.roomId, body, body);
    });

    it('Expect invite to room with domain', async () => {
        const body = translate('successMatrixInvite', {sender, roomName: alias});

        await invite({bodyText: alias, sender, room, chatApi});

        expect(chatApi.getRoomId).have.to.been.calledWithExactly(alias);
        expect(chatApi.invite).have.to.been.calledWithExactly(inviteRoomId, senderMatrixId);
        expect(chatApi.sendHtmlMessage).have.to.been.calledWithExactly(room.roomId, body, body);
    });

    it('Expect invite to not found room return no found warn', async () => {
        chatApi.getRoomId.throws('Error!!!');
        const body = translate('notFoundRoom', {roomName: bodyText});
        await invite({bodyText, sender, room, chatApi});

        expect(chatApi.getRoomId).to.have.been.thrown;
        expect(chatApi.invite).not.to.have.been.called;
        expect(chatApi.sendHtmlMessage).have.to.been.calledWithExactly(room.roomId, body, body);
    });

    it('Expect invite not admin user return no permission warn', async () => {
        const noAdminUser = 'fedor';
        const body = translate('notAdmin', {sender: noAdminUser});
        await invite({bodyText, sender: noAdminUser, room, chatApi});

        expect(chatApi.getRoomId).not.to.have.been.called;
        expect(chatApi.invite).not.to.have.been.called;
        expect(chatApi.sendHtmlMessage).have.to.been.calledWithExactly(room.roomId, body, body);
    });

    it('Expect some other error to be not handled', async () => {
        chatApi.invite.throws('Error!!!');
        let res;
        try {
            await invite({bodyText, sender, room, chatApi});
        } catch (err) {
            res = err;
        }

        expect(res).to.include('Matrix Invite command');
    });
});
