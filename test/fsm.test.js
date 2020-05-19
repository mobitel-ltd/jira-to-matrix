const { getChatApi } = require('./test-utils');
const app = require('../src/jira-app');
import * as delay from 'delay';
const Fsm = require('../src/fsm');
const { states } = require('../src/fsm/states');
const chai = require('chai');
const { stub } = require('sinon');
const sinonChai = require('sinon-chai');
const { expect } = chai;
const defaultConfig = require('../src/config');
const { matrix } = require('./fixtures/messenger-settings');
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
    const configMatrix = { ...defaultConfig, messenger: matrix };

    const handler = stub().resolves();

    afterEach(() => {
        handler.resetHistory();
        fsm.stop();
    });

    describe('Test without notify room', () => {
        beforeEach(() => {
            chatApi = getChatApi({ roomId: chatRoomId, config: configMatrix });
            chatApi.connect = async () => {
                await delay(100);
            };
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
    });

    describe('Test with notify room', () => {
        const matrixMessengerDataWithRoom = { ...matrix, infoRoom: { users: ['user1'], name: 'roomName' } };
        beforeEach(() => {
            const configWithInfo = { ...defaultConfig, messenger: matrixMessengerDataWithRoom };
            chatApi = getChatApi({
                roomId: chatRoomId,
                config: configWithInfo,
                alias: matrixMessengerDataWithRoom.infoRoom.name,
            });
        });

        it('Expect fsm state is "ready" sending info after connection (roomInfo exists in config)', async () => {
            fsm = new Fsm([chatApi], handler, app, port);
            await fsm.start();
            expect(chatApi.sendHtmlMessage).to.be.calledWithMatch(chatRoomId);
            // await fsm._handle();

            expect(fsm.state()).to.be.eq(states.ready);
        });

        describe('Info room is not exists', () => {
            beforeEach(() => {
                chatApi.getRoomIdByName.reset();
                chatApi.getRoomIdByName
                    .onFirstCall()
                    .resolves()
                    .onSecondCall()
                    .resolves(chatRoomId);
            });

            it('Expect create room to be called if no room with such name is exists', async () => {
                fsm = new Fsm([chatApi], handler, app, port);
                await fsm.start();

                expect(chatApi.createRoom).to.be.calledOnceWithExactly({
                    invite: matrixMessengerDataWithRoom.infoRoom.users.map(chatApi.getChatUserId),
                    name: matrixMessengerDataWithRoom.infoRoom.name,
                    room_alias_name: matrixMessengerDataWithRoom.infoRoom.name,
                });
                expect(chatApi.sendHtmlMessage).to.be.calledWithMatch(chatRoomId);
                expect(chatApi.invite).to.be.calledWithExactly(
                    chatRoomId,
                    ...matrixMessengerDataWithRoom.infoRoom.users.map(chatApi.getChatUserId),
                );
                expect(fsm.state()).to.be.eq(states.ready);
            });
        });
    });
});
