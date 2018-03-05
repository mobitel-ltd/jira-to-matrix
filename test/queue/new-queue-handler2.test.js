/* eslint {no-unused-expressions: 0, max-nested-callbacks: 0, global-require: 0} */
const {stub, spy} = require('sinon');
const sinonChai = require('sinon-chai');
const proxyquire = require('proxyquire');
const chai = require('chai');

const logger = require('../../src/modules/log.js')(module);
const JSONbody = require('../fixtures/create.json');
const getParsedAndSaveToRedis = require('../../src/queue/get-parsed-and-save-to-redis.js');
const createRoomStub = stub();
// const newSaveSpy = spy();

const {getRedisRooms, handleRedisRooms} = proxyquire('../../src/queue/redis-data-handle.js', {
    '../bot': {
        createRoom: createRoomStub,
        // newSave: newSaveSpy,
    },
});
const {prefix} = require('../fixtures/config.js').redis;
const redis = require('../../src/redis-client.js');

const {expect} = chai;
chai.use(sinonChai);

describe('Queue handler test', () => {
    let mclientStub;
    before(() => {
        mclientStub = stub();
    });

    // it('Room should be created', async () => {
    //     await getParsedAndSaveToRedis(JSONbody);
    //     const roomsKeys = await getRedisRooms();

    //     await handleRedisRooms(mclientStub, roomsKeys);

    //     const newRoomsKeys = await getRedisRooms();
    //     expect(createRoomStub).to.be.called;
    //     expect(newRoomsKeys).to.be.null;
    // });

    it('Room should not be created, room should be in redis', async () => {
        await getParsedAndSaveToRedis(JSONbody);
        const roomsKeys = await getRedisRooms();
        expect(roomsKeys).to.be.an('array').that.has.length(1);

        createRoomStub.throws('Incorrect room data');
        await handleRedisRooms(mclientStub, roomsKeys);
        // expect(newSaveSpy).to.be.called;
        const newRoomsKeys = await getRedisRooms();

        expect(newRoomsKeys).to.be.an('array').that.has.length(1);
        expect(newRoomsKeys).to.deep.equal(roomsKeys);
    });

    after(async () => {
        const keys = await redis.keysAsync('*');

        if (keys.length > 0) {
            const parsedKeys = keys.map(key => key.replace(`${prefix}`, ''));
            await redis.delAsync(parsedKeys);
        }
    });
});
