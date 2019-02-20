const faker = require('faker');
const utils = require('../../src/lib/utils.js');
const translate = require('../../src/locales');
const messages = require('../../src/lib/messages');
const {admins} = require('../../src/config').messenger;
const op = require('../../src/bot/timeline-handler/commands/op');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

const [sender] = admins;

describe('op test', () => {
    const fakeSender = faker.name.firstName();
    const userB = {displayName: 'Ivan Sergeevich B', name: 'is_b'};

    const roomName = 'BBCOM-123';

    const room = {
        roomId: 12345,
        members: [
            {
                userId: utils.getChatUserId(userB.name),
            },
            {
                userId: utils.getChatUserId(sender),
            },
        ],
        getJoinedMembers: () => room.members,
    };

    const chatApi = {
        sendHtmlMessage: stub(),
        setPower: stub(),
    };

    afterEach(() => {
        Object.values(chatApi).map(val => val.resetHistory());
    });

    it('Expect message about admin rules to be sent if user is not admin', async () => {
        const res = await op({sender: fakeSender, room, roomName, chatApi});

        const post = translate('notAdmin', {sender: fakeSender});
        expect(res).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(room.roomId, post, post);
        expect(chatApi.setPower).not.to.be.called;
    });

    it('Expect power level of sender to be put ("!op" command)', async () => {
        const res = await op({sender, room, roomName, chatApi});

        expect(res).to.be.eq(messages.getModeratorAddLog(utils.getChatUserId(sender), roomName));
        expect(chatApi.sendHtmlMessage).not.to.be.called;
        expect(chatApi.setPower).to.be.calledWithExactly(room.roomId, utils.getChatUserId(sender));
    });

    it('Expect power level of adding user to be put if he is a room member ("!op is_b")', async () => {
        const newBody = userB.name;
        const res = await op({bodyText: newBody, sender, room, roomName, chatApi});

        expect(res).to.be.eq(messages.getModeratorAddLog(utils.getChatUserId(userB.name), roomName));
        expect(chatApi.sendHtmlMessage).not.to.be.called;
        expect(chatApi.setPower).to.be.calledWithExactly(room.roomId, utils.getChatUserId(userB.name));
    });

    it('Expect power level of adding user NOT to be put if he is NOT a room member ("!op fake")', async () => {
        const newBody = fakeSender;
        const res = await op({bodyText: newBody, sender, room, roomName, chatApi});

        const post = translate('notFoundUser', {user: fakeSender});
        expect(res).to.be.eq(post);
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(room.roomId, post, post);
        expect(chatApi.setPower).not.to.be.called;
    });

    it('Expect some other error to be not handled', async () => {
        chatApi.sendHtmlMessage.throws('Error!!!');
        let res;
        try {
            res = await op({sender: fakeSender, room, roomName, chatApi});
        } catch (err) {
            res = err;
        }

        expect(res).to.include('Matrix Op command');
    });
});
