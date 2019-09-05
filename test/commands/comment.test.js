const nock = require('nock');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);
const translate = require('../../src/locales');
const testUtils = require('../test-utils');

const commandHandler = require('../../src/bot/timeline-handler');
const utils = require('../../src/lib/utils');
const schemas = require('../../src/lib/schemas.js');

describe('comment test', () => {
    let chatApi;
    let baseOptions;
    const roomName = 'BBCOM-123';
    const bodyText = 'text in body';
    const sender = 'user';
    const roomId = 12345;
    const commandName = 'comment';

    beforeEach(() => {
        chatApi = testUtils.getChatApi();
        baseOptions = {roomId, roomName, commandName, sender, chatApi, bodyText};
        nock(utils.getRestUrl())
            .post(`/issue/${roomName}/comment`, schemas.comment(sender, bodyText))
            .reply(201);
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it('Expect comment to be sent', async () => {
        const result = await commandHandler(baseOptions);
        expect(chatApi.sendHtmlMessage).not.to.be.called;
        expect(result).to.be.undefined;
    });

    it('Expect comment not to be sent with empty body and warn message will be sent', async () => {
        const post = translate('emptyMatrixComment');
        const result = await commandHandler({...baseOptions, bodyText: ''});

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, post, post);
    });
});
