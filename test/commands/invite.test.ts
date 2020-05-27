import { Commands } from '../../src/bot/commands';
import { getChatClass, taskTracker, getRoomId } from '../test-utils';
import { translate } from '../../src/locales';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { CommandNames } from '../../src/types';
import { config } from '../../src/config';

const { expect } = chai;
chai.use(sinonChai);

describe('invite test', () => {
    let chatApi;
    let baseOptions;
    const commands = new Commands(config, taskTracker);

    const commandName = CommandNames.Invite;
    // const inviteRoomId = getRoomId();
    const roomId = getRoomId();

    const bodyText = 'BBCOM-123';
    const sender = 'jira_test';
    const alias = `#${bodyText.toUpperCase()}@matrix.test-example.ru`;

    beforeEach(() => {
        chatApi = getChatClass({ alias: [bodyText, alias], roomId: [bodyText, alias] }).chatApiSingle;
        baseOptions = { roomId, bodyText, sender, chatApi };
    });

    it('Expect invite successfully', async () => {
        const body = translate('successMatrixInvite', { sender, roomName: bodyText });
        const result = await commands.run(commandName, baseOptions);

        expect(result).to.be.eq(body);
    });

    it('Expect invite to room with domain', async () => {
        const body = translate('successMatrixInvite', { sender, roomName: alias });
        const result = await commands.run(commandName, { ...baseOptions, bodyText: alias });

        expect(result).to.be.eq(body);
    });

    it('Expect invite to not found room return no found warn', async () => {
        const notFoundRoomName = 'notFoundRoom';
        const body = translate('notFoundRoom', { roomName: notFoundRoomName });
        const result = await commands.run(commandName, { ...baseOptions, bodyText: notFoundRoomName });

        expect(result).to.be.eq(body);
    });

    it('Expect invite not admin user return no permission warn', async () => {
        const noAdminUser = 'fedor';
        const body = translate('notAdmin', { sender: noAdminUser });
        const result = await commands.run(commandName, { ...baseOptions, sender: noAdminUser });

        expect(result).to.be.eq(body);
    });
});
