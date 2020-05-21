import { config } from '../../src/config';
const { matrix } from '../fixtures/messenger-settings');
const commandHandler from '../../src/bot/commands');
const { getChatClass } from '../test-utils');
import { translate } from '../../src/locales';
import { stub } from 'sinon';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
const { expect } = chai;
chai.use(sinonChai);

describe('getInfo test', () => {
    let chatApi;
    let baseOptions;

    const commandName = 'getInfo';
    const roomName = 'someRoomName';

    describe('No command room in config', () => {
        beforeEach(() => {
            chatApi = getChatClass();
            baseOptions = { roomName, commandName, chatApi };
        });

        it('Expect return error message if room is not command', async () => {
            const result = await commandHandler(baseOptions);

            expect(result).to.be.eq(translate('notCommandRoom'));
        });
    });

    describe('command room in config exists', () => {
        const matrixMessengerDataWithRoom = { ...matrix, infoRoom: { name: 'roomName' } };
        const configWithInfo = { ...defaultConfig, messenger: matrixMessengerDataWithRoom };
        const rooms = [
            { members: ['bot'], id: '#someId1', name: 'NOTTEST-123' },
            { members: ['user1', 'bot'], id: '#someId2', name: 'TEST-1' },
            { members: ['user1', 'user2', 'bot'], id: '#someId3', name: 'TEST' },
        ];

        beforeEach(() => {
            chatApi = getChatClass({
                config: configWithInfo,
            });
            chatSingle.getRooms = stub().resolves(rooms);
            baseOptions = { roomName, commandName, chatApi };
        });

        it('Expect return error message if room is not command', async () => {
            const result = await commandHandler(baseOptions);

            expect(result).to.be.eq(translate('notCommandRoom'));
        });

        it('Expect return correct message in command room', async () => {
            const body = translate('getInfo', { allRooms: rooms.length, single: 1, many: 2 });
            const result = await commandHandler({
                ...baseOptions,
                roomName: matrixMessengerDataWithRoom.infoRoom.name,
            });

            expect(result).to.be.eq(body);
        });

        it('Expect return only info for special project rooms if project name is set in body', async () => {
            // project rooms are not includes!!!
            const body = translate('getInfo', { allRooms: 1, single: 0, many: 1 });

            const result = await commandHandler({
                ...baseOptions,
                bodyText: 'TEST',
                roomName: matrixMessengerDataWithRoom.infoRoom.name,
            });

            expect(result).to.be.eq(body);
        });

        it('Expect return only info for "others" type rooms if project name is set as "others"', async () => {
            // project rooms are not includes!!!
            const body = translate('getInfo', { allRooms: 1, single: 0, many: 1 });

            const result = await commandHandler({
                ...baseOptions,
                bodyText: 'others',
                roomName: matrixMessengerDataWithRoom.infoRoom.name,
            });

            expect(result).to.be.eq(body);
        });
    });
});
