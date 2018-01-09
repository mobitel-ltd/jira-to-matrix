const config = require('../../src/config/');
const fakeConfig = require('../fixtures/config');
const Matrix = require('../../src/matrix');
const assert = require('assert');
const logger = require('../../src/modules/log.js')(module);
const nock = require('nock');

describe('Matrix api', async function() {
    this.timeout(15000);
    let client;
    const {password, userId, baseUrl} = config.matrix;
    const matrixUrl = `${baseUrl}/_matrix/client/r0`

    const LOGIN_DATA = {
        type: "m.login.password",
        user: userId,
        password,
    };
    
    const SYNC_DATA = {
        next_batch: "s_5_3",
        presence: { events: [] },
        rooms: {},
    };

    const KEEP_ALIVE_PATH = "/_matrix/client/versions";

    const FILTER_PATH = "/user/" + encodeURIComponent(userId) + "/filter";

    const FILTER_RESPONSE = {
        method: "POST",
        path: FILTER_PATH,
        data: { filter_id: "f1lt3r" },
    };



    before(() => {
        nock(matrixUrl)
            .post('/login', LOGIN_DATA)
            .reply(200, {access_token: 'accessToken'})

            .get('/sync', SYNC_DATA)
            .reply(200)

            .get('/pushrules/', {})
            .reply(200)

            .post(FILTER_PATH, { filter_id: "f1lt3r" })
            .reply(200, {access_token: 'accessToken'});  
    });

    it('test matrix true config connect from sdk-client', async () => {
        client = await Matrix.connect();
        logger.debug('client.getSyncState', Matrix.isConnected());
        logger.debug('client', client);
        assert.ok(Matrix.isConnected());
        Matrix.disconnect();
        // logger.debug('client.getSyncState', Matrix.getSyncState());
        assert.ifError(Matrix.isConnected());
    });
    
    // it('test matrix true config connect from sdk-client', async () => {
    //     const {connect, disconnect} = await init(config.matrix);
    //     client = await connect();
    //     logger.debug('client.getSyncState', client.getSyncState());
    //     assert.ok(client.clientRunning);
    //     await disconnect();
    //     logger.debug('client.getSyncState', client.getSyncState());
    //     assert.ifError(client.clientRunning);
    // });

    // it('test matrix fake config connect from sdk-client', async () => {
    //     try {
    //         const {connect} = await init(fakeConfig.matrix);
    //     } catch (err) {
    //         const funcErr = () => {
    //             throw err
    //         };
    //         assert.throws(funcErr, /No baseUrl/);
    //     }
    // });
    
    // it('test matrix connect with fake password from sdk-client', async () => {
    //     try {
    //         const {matrix} = config;
    //         const matrixWithFakePassword = {...matrix, password: 'fake'};
    //         const connect = await init(matrixWithFakePassword);
    //     } catch (err) {
    //         const funcErr = () => {
    //             throw err
    //         };
    //         assert.throws(funcErr, /Invalid password/);
    //     }
    // });

    // it('test matrixApi', async () => {
    //     const {connect, disconnect, helpers} = matrixApi;
    //     // const initconf = await init(config.matrix);
    //     // logger.debug('connect', connect);
    //     // logger.debug('init', initconf);
    //     const expected = ['createRoom', 'getRoomId', 'getRoomByAlias', 'getRoomMembers', 'invite', 'sendHtmlMessage', 'createAlias', 'setRoomName', 'setRoomTopic'];
    //     const api = await connect();
    //     const result = Object.values(api).map(func => func.name)
    //     assert.ok(expected, result);
    //     (await disconnect())();
    //     assert.ifError(client.clientRunning);
    //     logger.debug('helpers', helpers);
    // });

    
    // await after(async () => {
    //     if (client) {
    //         await client.stopClient();
    //     }
    // });

    // after(() => process.exit(1));
    
});