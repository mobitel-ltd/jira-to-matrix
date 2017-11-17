const config = require('../src/config/');
const fakeConfig = require('./fixtures/config');
const init = require('../src/matrix/sdk-client');
const appMatrix = require('../src/matrix');
const assert = require('assert');
const logger = require('debug')('test matrix');

describe('Matrix api', async function() {
    this.timeout(15000);
    let connection;

    it('test matrix true config connect from sdk-client', async () => {
        const {connect, disconnect} = init(config.matrix);
        // logger('disconect', disconnect());
        // connect().then(res => logger(res));
        connection = await connect();
        // logger('connection', connection);
        assert.ok(connection);
        logger('clientRunning', connection.clientRunning);
        // sdkConnect.connect().then(res => console.log(res));
        // const client = await appMatrix.connect();
        // console.log('client', client);
        // const sdkConnect = await connect();
        // assert.equal(typeof client, 'object');
        // await appMatrix.disconnect();
        
    });
    
    it('test matrix fake config connect from sdk-client', async () => {
        const fakeConnect = init(fakeConfig.matrix).connect;
        connection = await fakeConnect();
        // logger('fake connection', connection);
        assert.ifError(connection);
    });
    
    it('test matrix connect with fake password from sdk-client', async () => {
        const {matrix} = config;
        const matrixWithFakePassword = {...matrix, password: 'fake'};
        // logger(Object.values(matrixWithFakePassword));
        const fakeConnect = init(matrixWithFakePassword).connect;
        connection = await fakeConnect();
        // logger('fake connection', connection);
        assert.ifError(connection);
    });
    
    await afterEach(async () => {
        if (connection) {
            await connection.stopClient();
            logger('clientRunning', connection.clientRunning);
        }
    });

    // after(() => process.exit(1));
});
