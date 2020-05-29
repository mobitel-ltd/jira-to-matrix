import { expect } from 'chai';
import { cleanRedis, getChatClass, taskTracker } from '../test-utils';
import { config } from '../../src/config';
import { QueueHandler } from '../../src/queue';
import { Actions } from '../../src/bot/actions';

describe('Test save data to redis', () => {
    const { chatApi } = getChatClass();
    const actions = new Actions(config, taskTracker, chatApi);
    const queueHandler = new QueueHandler(taskTracker, config, actions);

    const expectedFuncKeys1 = [
        {
            redisKey: 'inviteNewMembers_1',
            funcName: 'inviteNewMembers',
            data: 'data',
        },
        {
            redisKey: 'postEpicUpdates_1',
            funcName: 'postEpicUpdates',
            data: 'data',
        },
    ];

    const expectedFuncKeys2 = [
        {
            redisKey: 'inviteNewMembers_2',
            funcName: 'inviteNewMembers',
            data: 'data',
        },
        {
            redisKey: 'postEpicUpdates_2',
            funcName: 'postEpicUpdates',
            data: 'data',
        },
    ];

    const expectedFuncKeys3 = [
        {
            redisKey: 'inviteNewMembers_3',
            funcName: 'inviteNewMembers',
            data: 'data',
        },
        {
            redisKey: 'postEpicUpdates_3',
            funcName: 'postEpicUpdates',
            data: 'data',
        },
    ];

    const room1 = {
        redisKey: 'newrooms',
        createRoomData: {
            issue: 'some data',
        },
    };
    const room2 = {
        redisKey: 'newrooms',
        createRoomData: { issue: 'some data else' },
    };
    const room3 = {
        redisKey: 'newrooms',
        createRoomData: null,
    };

    const dataToSave1 = [...expectedFuncKeys1, room1];
    const dataToSave2 = [...expectedFuncKeys2, room2];
    const dataToSave3 = [...expectedFuncKeys3, room3];

    before(async () => {
        await cleanRedis();
    });

    it('test no keys and rooms in redis', async () => {
        const keys = await queueHandler.getRedisKeys();
        expect(keys).to.be.empty;

        const data = await queueHandler.getDataFromRedis();
        expect(data).to.be.null;

        const rooms = await queueHandler.getRedisRooms();
        expect(rooms).to.be.null;
    });

    it('test no key', async () => {
        const result = await queueHandler.getRedisValue('NO_SUCH_KEY');

        expect(result).to.be.false;
    });

    it('test correct redis save', async () => {
        await Promise.all(dataToSave1.map(el => queueHandler.saveIncoming(el)));

        const funcKeysData = await queueHandler.getDataFromRedis();
        expectedFuncKeys1.forEach(key => expect(funcKeysData).to.deep.include(key));

        const roomsKeys = await queueHandler.getRedisRooms();
        const expectedRoom = [{ issue: 'some data' }];

        expect(roomsKeys).to.deep.equal(expectedRoom);
    });

    it('test second correct redis save', async () => {
        await Promise.all(dataToSave2.map(el => queueHandler.saveIncoming(el)));

        const funcKeysData = await queueHandler.getDataFromRedis();
        [...expectedFuncKeys1, ...expectedFuncKeys2].forEach(key => expect(funcKeysData).to.deep.include(key));

        const roomsKeys = await queueHandler.getRedisRooms();
        const expectedRoom = [{ issue: 'some data' }, { issue: 'some data else' }];

        expect(roomsKeys).to.deep.equal(expectedRoom);
    });

    it('test save empty room data', async () => {
        await Promise.all(dataToSave3.map(el => queueHandler.saveIncoming(el)));

        const funcKeysData = await queueHandler.getDataFromRedis();
        [...expectedFuncKeys1, ...expectedFuncKeys2, ...expectedFuncKeys3].forEach(key =>
            expect(funcKeysData).to.deep.include(key),
        );

        const roomsKeys = await queueHandler.getRedisRooms();
        const expectedRoom = [{ issue: 'some data' }, { issue: 'some data else' }];

        expect(roomsKeys).to.deep.equal(expectedRoom);
    });

    it("test don't save one room data two times", async () => {
        await Promise.all(dataToSave2.map(el => queueHandler.saveIncoming(el)));

        const funcKeysData = await queueHandler.getDataFromRedis();
        [...expectedFuncKeys1, ...expectedFuncKeys2].forEach(key => expect(funcKeysData).to.deep.include(key));

        const roomsKeys = await queueHandler.getRedisRooms();
        const expectedRoom = [{ issue: 'some data' }, { issue: 'some data else' }];

        expect(roomsKeys).to.deep.equal(expectedRoom);
    });

    after(async () => {
        await cleanRedis();
    });
});
