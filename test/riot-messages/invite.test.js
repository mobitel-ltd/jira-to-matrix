const {invite} = require('../../src/matrix/timeline-handler/commands');
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

    const matrixClient = {
        invite: stub(),
        getRoomId: stub(),
        sendHtmlMessage: stub(),
    };

    const bodyText = 'BBCOM-123';
    const sender = 'jira_test';
    const senderMatrixId = utils.getMatrixUserID(sender);
    const alias = utils.getMatrixRoomAlias(bodyText.toUpperCase());

    beforeEach(() => {
        matrixClient.getRoomId.resolves(inviteRoomId);
    });

    afterEach(() => {
        Object.values(matrixClient).map(val => val.reset());
    });

    it('Expect invite successfully', async () => {
        const body = translate('successMatrixInvite', {sender, roomName: bodyText});

        await invite({bodyText, sender, room, matrixClient});

        expect(matrixClient.getRoomId).have.to.been.calledWithExactly(alias);
        expect(matrixClient.invite).have.to.been.calledWithExactly(inviteRoomId, senderMatrixId);
        expect(matrixClient.sendHtmlMessage).have.to.been.calledWithExactly(room.roomId, body, body);
    });

    it('Expect invite to room with domain', async () => {
        const body = translate('successMatrixInvite', {sender, roomName: alias});

        await invite({bodyText: alias, sender, room, matrixClient});

        expect(matrixClient.getRoomId).have.to.been.calledWithExactly(alias);
        expect(matrixClient.invite).have.to.been.calledWithExactly(inviteRoomId, senderMatrixId);
        expect(matrixClient.sendHtmlMessage).have.to.been.calledWithExactly(room.roomId, body, body);
    });

    it('Expect invite to not found room return no found warn', async () => {
        matrixClient.getRoomId.throws('Error!!!');
        const body = translate('notFoundRoom', {roomName: bodyText});
        await invite({bodyText, sender, room, matrixClient});

        expect(matrixClient.getRoomId).have.to.been.thrown;
        expect(matrixClient.invite).not.to.have.been.called;
        expect(matrixClient.sendHtmlMessage).have.to.been.calledWithExactly(room.roomId, body, body);
    });

    it('Expect invite not admin user return no permission warn', async () => {
        const noAdminUser = 'Fedor';
        const body = translate('notAdmin', {sender: noAdminUser});
        await invite({bodyText, sender: noAdminUser, room, matrixClient});

        expect(matrixClient.getRoomId).not.to.have.been.called;
        expect(matrixClient.invite).not.to.have.been.called;
        expect(matrixClient.sendHtmlMessage).have.to.been.calledWithExactly(room.roomId, body, body);
    });

    it('Expect some other error to be not handled', async () => {
        matrixClient.invite.throws('Error!!!');
        let res;
        try {
            await invite({bodyText, sender, room, matrixClient});
        } catch (err) {
            res = err;
        }

        expect(res).to.include('Matrix Invite command');
    });
});
