const {invite} = require('../../src/matrix/timeline-handler/commands');
const {domain} = require('../fixtures/config.js').matrix;

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('invite test', () => {
    const inviteStub = stub().callsFake((roomId, userId) => {});
    const getRoomIdForAliasStub = stub().callsFake(room => ({room_id: room}));
    const sendHtmlMessageStub = stub().callsFake((roomId, body, htmlBody) => {});

    const matrixClient = {
        invite: inviteStub,
        getRoomIdForAlias: getRoomIdForAliasStub,
        sendHtmlMessage: sendHtmlMessageStub,
    };

    const bodyText = 'BBCOM-123';
    const sender = 'jira_test';
    const room = {roomId: 12345};

    afterEach(() => {
        getRoomIdForAliasStub.reset();
        inviteStub.reset();
        sendHtmlMessageStub.reset();
    });

    it('should invite', async () => {
        const expectedData = [
            room.roomId,
            'Успешно приглашен',
            'Успешно приглашен',
        ];

        const alias = `#${bodyText.toUpperCase()}:${domain}`;
        await invite({bodyText, sender, room, matrixClient});
        const userId = `@${sender}:${domain}`;

        expect(getRoomIdForAliasStub).have.to.been.calledWithExactly(alias);
        expect(inviteStub).have.to.been.calledWithExactly(alias, userId);
        expect(sendHtmlMessageStub).have.to.been.calledWithExactly(...expectedData);
    });

    it('should invite to room with domain', async () => {
        getRoomIdForAliasStub.callsFake(room => ({room_id: room}));
        const expectedData = [
            room.roomId,
            'Успешно приглашен',
            'Успешно приглашен',
        ];

        const alias = `#${bodyText.toUpperCase()}:${domain}`;
        await invite({bodyText: alias, sender, room, matrixClient});
        const userId = `@${sender}:${domain}`;

        expect(getRoomIdForAliasStub).have.to.been.calledWithExactly(alias);
        expect(inviteStub).have.to.been.calledWithExactly(alias, userId);
        expect(sendHtmlMessageStub).have.to.been.calledWithExactly(...expectedData);
    });

    it('invite error', async () => {
        const expectedData = [
            room.roomId,
            'Ошибка при присоединение к комнате',
            'Error in getRoomId\nError!!!',
        ];
        getRoomIdForAliasStub.throws('Error!!!');
        await invite({bodyText, sender, room, matrixClient});

        expect(getRoomIdForAliasStub).have.to.been.thrown;
        expect(inviteStub).not.to.have.been.called;
        expect(sendHtmlMessageStub).have.to.been.calledWithExactly(...expectedData);
    });

    it('invite rights error', async () => {
        const expectedData = [
            room.roomId,
            'У вас нет прав на это действие',
            'У вас нет прав на это действие',
        ];
        getRoomIdForAliasStub.throws('Error!!!');
        await invite({bodyText, sender: 'Fedor', room, matrixClient});

        expect(getRoomIdForAliasStub).not.to.have.been.called;
        expect(inviteStub).not.to.have.been.called;
        expect(sendHtmlMessageStub).have.to.been.calledWithExactly(...expectedData);
    });
});
