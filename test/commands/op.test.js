const faker = require('faker');
const translate = require('../../src/locales');
const { admins } = require('../../src/config').messenger;
const commandHandler = require('../../src/bot/timeline-handler');

const chai = require('chai');
const { stub } = require('sinon');
const sinonChai = require('sinon-chai');
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

    chatApi.isRoomMember
        .withArgs(roomId, chatApi.getChatUserId(sender))
        .resolves(true)
        .withArgs(roomId, chatApi.getChatUserId(userToAdd))
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
        expect(chatApi.sendHtmlMessage).to.be.calledOnceWithExactly(roomId, post, post);
        expect(chatApi.setPower).to.be.calledWithExactly(roomId, chatApi.getChatUserId(sender));
    });

    it('Expect message about admin rules to be sent if user is not admin', async () => {
        const res = await commandHandler({ ...baseOptions, sender: fakeSender });

        const post = translate('notAdmin', { sender: fakeSender });
        expect(res).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, post, post);
        expect(chatApi.setPower).not.to.be.called;
    });

    it('Expect power level of adding user to be put if he is a room member ("!op is_b")', async () => {
        const post = translate('powerUp', { targetUser: userToAdd, roomName });
        const res = await commandHandler({ ...baseOptions, bodyText: userToAdd });

        expect(res).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.be.calledOnceWithExactly(roomId, post, post);
        expect(chatApi.setPower).to.be.calledWithExactly(roomId, chatApi.getChatUserId(userToAdd));
    });

    it('Expect power level of adding user NOT to be put if he is NOT a room member ("!op fake")', async () => {
        const post = translate('notFoundUser', { user: fakeSender });
        const res = await commandHandler({ ...baseOptions, bodyText: fakeSender });

        expect(res).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, post, post);
        expect(chatApi.setPower).not.to.be.called;
    });
});
