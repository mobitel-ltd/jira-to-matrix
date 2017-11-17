const config = require('../src/config/');
const fakeConfig = require('./fixtures/config');
const init = require('../src/matrix/sdk-client');
const appMatrix = require('../src/matrix');
const assert = require('assert');
const logger = require('debug')('test matrix');

describe('Matrix api', () => {
    it('test matrix connect from sdk-client', async () => {
        const connect = init(config.matrix).connect;
        // logger(Object.keys(matrix));
        // connect().then(res => logger(res));
        const connection = await connect();
        // logger('connection', connection);
        assert.ok(connection);
        // sdkConnect.connect().then(res => console.log(res));
        // const client = await appMatrix.connect();
        // console.log('client', client);
        // const sdkConnect = await connect();
        // assert.equal(typeof client, 'object');
        // await appMatrix.disconnect();
    });
    
    it('test matrix connect from sdk-client', async () => {
        const fakeConnect = init(fakeConfig.matrix).connect;
        const connection = await fakeConnect();
        // logger('fake connection', connection);
        assert.ifError(connection);
    });        
});
