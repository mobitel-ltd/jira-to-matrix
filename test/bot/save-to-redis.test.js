const {expect} = require('chai');
const logger = require('../../src/modules/log.js')(module);
const {newSave} = require('../../src/bot');
const {prefix} = require('../fixtures/config.js').redis;
const redis = require('../../src/redis-client.js');
const {getRedisKeys, getDataFromRedis, getRedisRooms} = require('../../src/queue/redis-data-handle.js');

describe('get-bot-data', () => {
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
            createRoomData: 'some data',
    };
    const room2 = {
            redisKey: 'rooms',
            createRoomData: 'some data else',
    };
    const room3 = {
        redisKey: 'rooms',
        createRoomData: null,
    };

    const dataToSave1 = [...expectedFuncKeys1, room1];
    const dataToSave2 = [...expectedFuncKeys2, room2];
    const dataToSave3 = [...expectedFuncKeys3, room3];


    it('test correct redis save', async () => {
        await Promise.all(dataToSave1.map(newSave));

        const redisKeys = await getRedisKeys();
        const funcKeysData = await getDataFromRedis(redisKeys);
        expectedFuncKeys1.forEach(key => expect(funcKeysData).to.deep.include(key));

        const roomsKeys = await getRedisRooms();
        const expectedRoom = [
            'some data',
        ];

        expect(roomsKeys).to.deep.equal(expectedRoom);
    });

    it('test  second correct redis save', async () => {
        await Promise.all(dataToSave2.map(newSave));

        const redisKeys = await getRedisKeys();
        const funcKeysData = await getDataFromRedis(redisKeys);
        [...expectedFuncKeys1, ...expectedFuncKeys2]
            .forEach(key => expect(funcKeysData).to.deep.include(key));

        const roomsKeys = await getRedisRooms();
        const expectedRoom = [
            'some data',
            'some data else',
        ];

        expect(roomsKeys).to.deep.equal(expectedRoom);
    });

    it('test save empty room data', async () => {
        await Promise.all(dataToSave3.map(newSave));

        const redisKeys = await getRedisKeys();
        const funcKeysData = await getDataFromRedis(redisKeys);
        [...expectedFuncKeys1, ...expectedFuncKeys2, ...expectedFuncKeys3]
        .forEach(key => expect(funcKeysData).to.deep.include(key));

        const roomsKeys = await getRedisRooms();
        const expectedRoom = [
            'some data',
            'some data else',
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
