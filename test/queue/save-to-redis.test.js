const {expect} = require('chai');
const {saveIncoming} = require('../../src/queue/redis-data-handle.js');
const {prefix} = require('../fixtures/config.js').redis;
const redis = require('../../src/redis-client.js');
const {getRedisValue, getRedisKeys, getDataFromRedis, getRedisRooms} = require('../../src/queue/redis-data-handle.js');

describe('Save data to redis', () => {
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
        redisKey: 'rooms',
        createRoomData: {
            issue: 'some data',
        },
    };
    const room2 = {
        redisKey: 'rooms',
        createRoomData: {issue: 'some data else'},
    };
    const room3 = {
        redisKey: 'rooms',
        createRoomData: null,
    };

    const dataToSave1 = [...expectedFuncKeys1, room1];
    const dataToSave2 = [...expectedFuncKeys2, room2];
    const dataToSave3 = [...expectedFuncKeys3, room3];

    it('test no keys and rooms in redis', async () => {
        const keys = await getRedisKeys();
        expect(keys).to.be.empty;

        const data = await getDataFromRedis();
        expect(data).to.be.null;

        const rooms = await getRedisRooms();
        expect(rooms).to.be.null;
    });

    it('test no fake key', async () => {
        const result = await getRedisValue('NO_SUCH_KEY');

        expect(result).to.be.false;
    });

    it('test correct redis save', async () => {
        await Promise.all(dataToSave1.map(saveIncoming));

        const redisKeys = await getRedisKeys();
        const funcKeysData = await getDataFromRedis(redisKeys);
        expectedFuncKeys1.forEach(key => expect(funcKeysData).to.deep.include(key));

        const roomsKeys = await getRedisRooms();
        const expectedRoom = [
            {issue: 'some data'},
        ];

        expect(roomsKeys).to.deep.equal(expectedRoom);
    });

    it('test second correct redis save', async () => {
        await Promise.all(dataToSave2.map(saveIncoming));

        const redisKeys = await getRedisKeys();
        const funcKeysData = await getDataFromRedis(redisKeys);
        [...expectedFuncKeys1, ...expectedFuncKeys2]
            .forEach(key => expect(funcKeysData).to.deep.include(key));

        const roomsKeys = await getRedisRooms();
        const expectedRoom = [
            {issue: 'some data'},
            {issue: 'some data else'},
        ];

        expect(roomsKeys).to.deep.equal(expectedRoom);
    });

    it('test save empty room data', async () => {
        await Promise.all(dataToSave3.map(saveIncoming));

        const redisKeys = await getRedisKeys();
        const funcKeysData = await getDataFromRedis(redisKeys);
        [...expectedFuncKeys1, ...expectedFuncKeys2, ...expectedFuncKeys3]
            .forEach(key => expect(funcKeysData).to.deep.include(key));

        const roomsKeys = await getRedisRooms();
        const expectedRoom = [
            {issue: 'some data'},
            {issue: 'some data else'},
        ];


        expect(roomsKeys).to.deep.equal(expectedRoom);
    });

    it('test don\'t save one room data two times', async () => {
        await Promise.all(dataToSave2.map(saveIncoming));

        const redisKeys = await getRedisKeys();
        const funcKeysData = await getDataFromRedis(redisKeys);
        [...expectedFuncKeys1, ...expectedFuncKeys2]
            .forEach(key => expect(funcKeysData).to.deep.include(key));

        const roomsKeys = await getRedisRooms();
        const expectedRoom = [
            {issue: 'some data'},
            {issue: 'some data else'},
        ];

        expect(roomsKeys).to.deep.equal(expectedRoom);
    });


    after(async () => {
        const keys = await redis.keysAsync('*');

        if (keys.length > 0) {
            const parsedKeys = keys.map(key => key.replace(`${prefix}`, ''));
            await redis.delAsync(parsedKeys);
        }
    });
});
