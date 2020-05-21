import nock from 'nock';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
const { expect } = chai;
chai.use(sinonChai);
import { translate } from '../../src/locales';
const testUtils from '../test-utils');

const commandHandler from '../../src/bot/commands');
const utils from '../../src/lib/utils');
const schemas from '../../src/lib/schemas';

describe('comment test', () => {
    let chatApi;
    let baseOptions;
    const roomName = 'BBCOM-123';
    const bodyText = 'text in body';
    const sender = 'user';
    const roomId = 12345;
    const commandName = 'comment';

    beforeEach(() => {
        chatApi = testUtils.getChatClass();
        baseOptions = { roomId, roomName, commandName, sender, chatApi, bodyText };
        nock(utils.getRestUrl())
            .post(`/issue/${roomName}/comment`, schemas.comment(sender, bodyText))
            .reply(201);
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it('Expect comment to be sent', async () => {
        const result = await commandHandler(baseOptions);
        expect(chatSingle.sendHtmlMessage).not.to.be.called;
        expect(result).to.be.undefined;
    });

    it('Expect comment not to be sent with empty body and warn message will be sent', async () => {
        const post = translate('emptyMatrixComment');
        const result = await commandHandler({ ...baseOptions, bodyText: '' });

        expect(result).to.be.eq(post);
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomId, post, post);
    });
});
