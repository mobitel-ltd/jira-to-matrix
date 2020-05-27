import * as defaultConfig from '../../src/config';
import { matrix } from '../fixtures/messenger-settings';
import { getChatClass, taskTracker } from '../test-utils';
import { translate } from '../../src/locales';
import { Commands } from '../../src/bot/commands';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { CommandNames } from '../../src/types';

const { expect } = chai;
chai.use(sinonChai);

describe('alive test', () => {
    let chatApi;
    let baseOptions;

    const commandName = CommandNames.Alive;
    const roomName = 'someRoomName';

    describe('No command room in config', () => {
        const commands = new Commands(defaultConfig.config, taskTracker);

        beforeEach(() => {
            const chatClass = getChatClass();
            chatApi = chatClass.chatApiSingle;
            const roomData = chatClass.getRoomData({ alias: roomName });

            baseOptions = { roomName, commandName, chatApi, roomData };
        });

        it('Expect return error message if room is not command', async () => {
            const result = await commands.run(commandName, baseOptions);

            expect(result).to.be.eq(translate('notCommandRoom'));
        });
    });

    describe('command room in config exists', () => {
        let getRoomData;
        const matrixMessengerDataWithRoom = { ...matrix, infoRoom: { name: 'roomName' } };
        const configWithInfo = { ...defaultConfig.config, messenger: matrixMessengerDataWithRoom };
        const commands = new Commands(configWithInfo, taskTracker);

        beforeEach(() => {
            const chatClass = getChatClass({
                config: configWithInfo,
            });
            chatApi = chatClass.chatApiSingle;
            getRoomData = chatClass.getRoomData;
            const roomData = chatClass.getRoomData({ alias: roomName });

            baseOptions = { roomName, chatApi, roomData };
        });

        it('Expect return error message if room is not command', async () => {
            const result = await commands.run(commandName, baseOptions);

            expect(result).to.be.eq(translate('notCommandRoom'));
        });

        it('Expect return correct message in command room', async () => {
            const body = translate('alive', { botId: chatApi.getMyId() });
            const roomData = getRoomData({ alias: matrixMessengerDataWithRoom.infoRoom.name });
            const result = await commands.run(commandName, {
                ...baseOptions,
                roomData,
                roomName: matrixMessengerDataWithRoom.infoRoom.name,
            });

            expect(result).to.be.eq(body);
        });
    });
});
