import * as faker from 'faker';
import { translate } from '../../src/locales';
const { admins } from '../../src/config').messenger;
const commandHandler from '../../src/bot/commands');

import * as chai from 'chai';
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';
const { expect } = chai;
chai.use(sinonChai);

describe('op test', () => {
    const [sender] = admins;
    const userToAdd = faker.name.firstName();
    const fakeSender = faker.name.firstName();

    const roomName = 'BBCOM-123';

    const roomId = 12345;

    const chatApi = {
        isRoomMember: stub().resolves(false),
        sendHtmlMessage: stub(),
        setPower: stub(),
        getChatUserId: stub().callsFake(name => name),
    };

    chatSingle.isRoomMember
        .withArgs(roomId, chatSingle.getChatUserId(sender))
        .resolves(true)
        .withArgs(roomId, chatSingle.getChatUserId(userToAdd))
        .resolves(true);

    const commandName = 'op';

    const baseOptions = { roomId, sender, roomName, commandName, chatApi };

    afterEach(() => {
        Object.values(chatApi).map(val => val.resetHistory());
    });

    it('Expect power level of sender to be put ("!op" command)', async () => {
        const post = translate('powerUp', { targetUser: sender, roomName });
        const res = await commandHandler(baseOptions);

        expect(res).to.be.eq(post);
        expect(chatSingle.sendHtmlMessage).to.be.calledOnceWithExactly(roomId, post, post);
        expect(chatSingle.setPower).to.be.calledWithExactly(roomId, chatSingle.getChatUserId(sender));
    });

    it('Expect message about admin rules to be sent if user is not admin', async () => {
        const res = await commandHandler({ ...baseOptions, sender: fakeSender });

        const post = translate('notAdmin', { sender: fakeSender });
        expect(res).to.be.eq(post);
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomId, post, post);
        expect(chatSingle.setPower).not.to.be.called;
    });

    it('Expect power level of adding user to be put if he is a room member ("!op is_b")', async () => {
        const post = translate('powerUp', { targetUser: userToAdd, roomName });
        const res = await commandHandler({ ...baseOptions, bodyText: userToAdd });

        expect(res).to.be.eq(post);
        expect(chatSingle.sendHtmlMessage).to.be.calledOnceWithExactly(roomId, post, post);
        expect(chatSingle.setPower).to.be.calledWithExactly(roomId, chatSingle.getChatUserId(userToAdd));
    });

    it('Expect power level of adding user NOT to be put if he is NOT a room member ("!op fake")', async () => {
        const post = translate('notFoundUser', { user: fakeSender });
        const res = await commandHandler({ ...baseOptions, bodyText: fakeSender });

        expect(res).to.be.eq(post);
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomId, post, post);
        expect(chatSingle.setPower).not.to.be.called;
    });
});
