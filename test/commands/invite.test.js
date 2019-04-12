const commandHandler = require('../../src/bot/timeline-handler');
const translate = require('../../src/locales');

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
    });

    it('Expect invite to room with domain', async () => {
        const body = translate('successMatrixInvite', {sender, roomName: alias});
        const result = await commandHandler({...baseOptions, bodyText: alias});

        expect(result).to.be.eq(body);
    });

    it('Expect invite to not found room return no found warn', async () => {
        chatApi.getRoomIdByName.resolves(false);
        const body = translate('notFoundRoom', {roomName: bodyText});
        const result = await commandHandler(baseOptions);

        expect(result).to.be.eq(body);
    });

    it('Expect invite not admin user return no permission warn', async () => {
        const noAdminUser = 'fedor';
        const body = translate('notAdmin', {sender: noAdminUser});
        const result = await commandHandler({...baseOptions, sender: noAdminUser});

        expect(result).to.be.eq(body);
    });
});
