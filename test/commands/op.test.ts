import * as faker from 'faker';
import { translate } from '../../src/locales';
import { config } from '../../src/config';
import { Commands } from '../../src/bot/commands';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { getChatClass, getRoomId, taskTracker } from '../test-utils';
import { CommandNames } from '../../src/types';

const { expect } = chai;
chai.use(sinonChai);

describe('op test', () => {
    let chatApi;
    let baseOptions;
    const commands = new Commands(config, taskTracker);

    const commandName = CommandNames.Op;

    const [sender] = config.messenger.admins;
    const userToAdd = faker.name.firstName();
    const fakeSender = faker.name.firstName();

    const roomName = 'BBCOM-123';

    const roomId = getRoomId();

    beforeEach(() => {
        chatApi = getChatClass().chatApiSingle;
        baseOptions = { roomId, sender, roomName, chatApi };
        chatApi.isRoomMember
            .withArgs(roomId, chatApi.getChatUserId(sender))
            .resolves(true)
            .withArgs(roomId, chatApi.getChatUserId(userToAdd))
            .resolves(true);
    });

    it('Expect power level of sender to be put ("!op" command)', async () => {
        const post = translate('powerUp', { targetUser: sender, roomName });
        const res = await commands.run(commandName, baseOptions);

        expect(res).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.be.calledOnceWithExactly(roomId, post, post);
        expect(chatApi.setPower).to.be.calledWithExactly(roomId, chatApi.getChatUserId(sender));
    });

    it('Expect message about admin rules to be sent if user is not admin', async () => {
        const res = await commands.run(commandName, { ...baseOptions, sender: fakeSender });

        const post = translate('notAdmin', { sender: fakeSender });
        expect(res).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, post, post);
        expect(chatApi.setPower).not.to.be.called;
    });

    it('Expect power level of adding user to be put if he is a room member ("!op is_b")', async () => {
        const post = translate('powerUp', { targetUser: userToAdd, roomName });
        const res = await commands.run(commandName, { ...baseOptions, bodyText: userToAdd });

        expect(res).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.be.calledOnceWithExactly(roomId, post, post);
        expect(chatApi.setPower).to.be.calledWithExactly(roomId, chatApi.getChatUserId(userToAdd));
    });

    it('Expect power level of adding user NOT to be put if he is NOT a room member ("!op fake")', async () => {
        const post = translate('notFoundUser', { user: fakeSender });
        const res = await commands.run(commandName, { ...baseOptions, bodyText: fakeSender });

        expect(res).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, post, post);
        expect(chatApi.setPower).not.to.be.called;
    });
});
