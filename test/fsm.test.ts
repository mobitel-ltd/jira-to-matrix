import { getChatClass } from './test-utils';
import { getServer } from '../src/server';
import delay from 'delay';
import { FSM } from '../src/fsm';
import { states } from '../src/fsm/states';
import * as chai from 'chai';
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';
import * as defaultConfig from '../src/config';
import { matrix } from './fixtures/messenger-settings';
import { getTaskTracker } from '../src/task-trackers';

chai.use(sinonChai);
const { expect } = chai;

describe('Fsm test', () => {
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
    const configMatrix = { ...defaultConfig.config, messenger: matrix };
    const taskTracker = getTaskTracker(defaultConfig.config);

    const handler = stub().resolves();

    afterEach(() => {
        handler.resetHistory();
        fsm.stop();
    });

    describe('Test without notify room', () => {
        beforeEach(() => {
            chatApi = getChatClass({ roomId: chatRoomId, config: configMatrix }).chatApiSingle;
            chatApi.connect = async () => {
                await delay(100);
            };
        });

        it('Expect fsm state is "ready" after queue is handled', async () => {
            fsm = new FSM([chatApi], getServer, taskTracker, defaultConfig.config);
            await fsm.start();
            await fsm._handle();

            expect(fsm.state()).to.be.eq(states.ready);
        });

        // this test is spip because handler is not passed as argument
        it.skip('Expect fsm state is "ready" after start connection and call handle during connection', async () => {
            fsm = new FSM([chatApi], getServer, taskTracker, defaultConfig.config);
            await fsm.start();
            await fsm.handleHook();
            await delay(50);

            expect(handler).to.be.calledTwice;
            expect(fsm.state()).to.be.eq(states.ready);
            expect(fsm.history()).to.be.deep.eq(expectedData);
        });

        // this test is spip because handler is not passed as argument
        it.skip('Expect fsm wait until handling is finished but new hook we get', async () => {
            const longTimeHandler = stub()
                .callsFake(() => delay(100))
                .resolves();
            fsm = new FSM([chatApi], getServer, taskTracker, defaultConfig.config);
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
            const configWithInfo = { ...defaultConfig.config, messenger: matrixMessengerDataWithRoom };
            chatApi = getChatClass({
                roomId: chatRoomId,
                config: configWithInfo,
                alias: matrixMessengerDataWithRoom.infoRoom.name,
            }).chatApiSingle;
        });

        it('Expect fsm state is "ready" sending info after connection (roomInfo exists in config)', async () => {
            fsm = new FSM([chatApi], getServer, taskTracker, defaultConfig.config);
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
                fsm = new FSM([chatApi], getServer, taskTracker, defaultConfig.config);
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
