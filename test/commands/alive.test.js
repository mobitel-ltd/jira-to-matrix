const defaultConfig = require('../../src/config');
const { matrix } = require('../fixtures/messenger-settings');
const commandHandler = require('../../src/bot/commands');
const { getChatApi } = require('../test-utils');
const translate = require('../../src/locales');

const chai = require('chai');
const sinonChai = require('sinon-chai');
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
            chatApi = getChatApi();
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
            chatApi = getChatApi({
                config: configWithInfo,
            });
            baseOptions = { roomName, commandName, chatApi, config };
        });

        it('Expect return error message if room is not command', async () => {
            const result = await commandHandler(baseOptions);

            expect(result).to.be.eq(translate('notCommandRoom'));
        });

        it('Expect return correct message in command room', async () => {
            const body = translate('alive', { botId: chatApi.getMyId() });
            const result = await commandHandler({
                ...baseOptions,
                roomName: matrixMessengerDataWithRoom.infoRoom.name,
            });

            expect(result).to.be.eq(body);
        });
    });
});
