import { config } from '../../src/config';
const { matrix } from '../fixtures/messenger-settings');
const commandHandler from '../../src/bot/commands');
const { getChatClass } from '../test-utils');
import { translate } from '../../src/locales';

import * as chai from 'chai';
import sinonChai from 'sinon-chai';
const { expect } = chai;
chai.use(sinonChai);

describe('alive test', () => {
    let chatApi;
    let baseOptions;

    const commandName = 'alive';
    const roomName = 'someRoomName';
    const config = {};

    describe('No command room in config', () => {
        beforeEach(() => {
            chatApi = getChatClass();
            baseOptions = { roomName, commandName, chatApi, config };
        });

        it('Expect return error message if room is not command', async () => {
            const result = await commandHandler(baseOptions);

            expect(result).to.be.eq(translate('notCommandRoom'));
        });
    });

    describe('command room in config exists', () => {
        const matrixMessengerDataWithRoom = { ...matrix, infoRoom: { name: 'roomName' } };
        const configWithInfo = { ...defaultConfig, messenger: matrixMessengerDataWithRoom };

        beforeEach(() => {
            chatApi = getChatClass({
                config: configWithInfo,
            });
            baseOptions = { roomName, commandName, chatApi, config };
        });

        it('Expect return error message if room is not command', async () => {
            const result = await commandHandler(baseOptions);

            expect(result).to.be.eq(translate('notCommandRoom'));
        });

        it('Expect return correct message in command room', async () => {
            const body = translate('alive', { botId: chatSingle.getMyId() });
            const result = await commandHandler({
                ...baseOptions,
                roomName: matrixMessengerDataWithRoom.infoRoom.name,
            });

            expect(result).to.be.eq(body);
        });
    });
});
