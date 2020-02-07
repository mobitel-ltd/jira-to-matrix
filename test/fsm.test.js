const app = require('../src/jira-app');
const delay = require('delay');
const Fsm = require('../src/fsm');
const { states } = require('../src/fsm/states');
const chai = require('chai');
const { stub } = require('sinon');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);

describe('Fsm test', () => {
    const port = 3000;
    const expectedData = [
        states.init,
        states.startConnection,
        states.ready,
        states.startHandling,
        states.ready,
        states.startHandling,
        states.ready,
    ];
    let fsm;
    let chatApi;
    const chatRoomId = 'roomId';
    const config = { user: 'fakeName', admins: ['admin'] };
    const configWithUserInfo = { ...config, infoRoom: { users: ['user1'], name: 'roomName' } };
    const getId = name => `@${name}`;

    beforeEach(() => {
        chatApi = {
            connect: async () => {
                await delay(100);
            },
            disconnect: stub(),
            getRoomIdByName: stub()
                .withArgs(configWithUserInfo.infoRoom.name)
                .resolves(chatRoomId),
            isInRoom: stub().resolves(true),
            sendHtmlMessage: stub(),
            createRoom: stub().resolves(chatRoomId),
            getChatUserId: stub().callsFake(getId),
            invite: stub(),
            config,
        };
    });

    const handler = stub().resolves();

    afterEach(() => {
        handler.resetHistory();
        fsm.stop();
    });

    it('Expect fsm state is "ready" after queue is handled', async () => {
        fsm = new Fsm([chatApi], handler, app, port);
        await fsm.start();
        await fsm._handle();

        expect(fsm.state()).to.be.eq(states.ready);
    });

    it('Expect fsm state is "ready" after start connection and call handle during connection', async () => {
        fsm = new Fsm([chatApi], handler, app, port);
        await fsm.start();
        await fsm.handleHook();
        await delay(50);

        expect(handler).to.be.calledTwice;
        expect(fsm.state()).to.be.eq(states.ready);
        expect(fsm.history()).to.be.deep.eq(expectedData);
    });

    it('Expect fsm wait until handling is finished but new hook we get', async () => {
        const longTimeHandler = stub()
            .callsFake(() => delay(100))
            .resolves();
        fsm = new Fsm([chatApi], longTimeHandler, app, port);
        await fsm.start();
        await delay(50);
        await fsm.handleHook();

        expect(longTimeHandler).to.be.calledTwice;
        expect(fsm.state()).to.be.eq(states.ready);
        expect(fsm.history()).to.be.deep.eq(expectedData);
    });

    it('Expect fsm state is "ready" sending info after connection (roomInfo exists in config)', async () => {
        fsm = new Fsm([{ ...chatApi, config: configWithUserInfo }], handler, app, port);
        await fsm.start();
        expect(chatApi.sendHtmlMessage).to.be.calledWithMatch(chatRoomId);
        // await fsm._handle();

        expect(fsm.state()).to.be.eq(states.ready);
    });

    it('Expect create room to be called if no room with such name is exists', async () => {
        chatApi.getRoomIdByName
            .onFirstCall()
            .resolves()
            .onSecondCall()
            .resolves(chatRoomId);
        fsm = new Fsm([{ ...chatApi, config: configWithUserInfo }], handler, app, port);
        await fsm.start();
        expect(chatApi.createRoom).to.be.calledOnceWithExactly({
            invite: configWithUserInfo.infoRoom.users.map(getId),
            name: configWithUserInfo.infoRoom.name,
            room_alias_name: configWithUserInfo.infoRoom.name,
        });
        expect(chatApi.sendHtmlMessage).to.be.calledWithMatch(chatRoomId);
        expect(chatApi.invite).to.be.calledWithExactly(chatRoomId, getId(config.user));
        expect(chatApi.invite).to.be.calledWithExactly(chatRoomId, ...configWithUserInfo.infoRoom.users.map(getId));

        expect(fsm.state()).to.be.eq(states.ready);
    });
});
