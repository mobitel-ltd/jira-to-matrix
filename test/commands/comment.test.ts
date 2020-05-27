import nock from 'nock';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { translate } from '../../src/locales';
import { getChatClass, taskTracker, getRoomId } from '../test-utils';
import { Commands } from '../../src/bot/commands';
import * as utils from '../../src/lib/utils';
import { schemas } from '../../src/task-trackers/jira/schemas';
import { CommandNames } from '../../src/types';
import { config } from '../../src/config';

const { expect } = chai;
chai.use(sinonChai);

describe('comment test', () => {
    let chatApi;
    let baseOptions;
    const commands = new Commands(config, taskTracker);

    const commandName = CommandNames.Comment;
    const roomName = 'BBCOM-123';
    const bodyText = 'text in body';
    const sender = 'user';
    const roomId = getRoomId();

    beforeEach(() => {
        chatApi = getChatClass().chatApiSingle;

        baseOptions = { roomId, roomName, sender, chatApi, bodyText };
        nock(utils.getRestUrl())
            .post(`/issue/${roomName}/comment`, schemas.comment(sender, bodyText))
            .reply(201);
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it('Expect comment to be sent', async () => {
        const result = await commands.run(commandName, baseOptions);
        expect(chatApi.sendHtmlMessage).not.to.be.called;
        expect(result).to.be.undefined;
    });

    it('Expect comment not to be sent with empty body and warn message will be sent', async () => {
        const post = translate('emptyMatrixComment');
        const result = await commands.run(commandName, { ...baseOptions, bodyText: '' });

        expect(result).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, post, post);
    });
});
