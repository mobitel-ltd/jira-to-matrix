const logger = require('debug')('test matrix');
const config = require('../src/config/');
const fakeConfig = require('./fixtures/config');
const init = require('../src/matrix/sdk-client');
const appMatrix = require('../src/matrix');
const assert = require('assert');
global.Olm = require('olm');
const sdk = require('matrix-js-sdk');

describe('Matrix api sdk', async function() {
    this.timeout(15000);
    let connection;

    const createClient = async ({baseUrl = null, userId, password}) => {
        try {
            if (!baseUrl) {
                throw new Error('No baseUrl');
            }
    
            // Создает сущность класса MatrixClient http://matrix-org.github.io/matrix-js-sdk/0.8.5/module-client-MatrixClient.html
            const client = await sdk.createClient(baseUrl);
            // logger('client before login', client);
            // http://matrix-org.github.io/matrix-js-sdk/0.8.5/module-base-apis-MatrixBaseApis.html
            // в случае аутентификации возвращает объект типа { login: { access_token, home_server, user_id, device_id } }
            const login = await client.loginWithPassword(userId, password);
            if (!login.access_token) {
                throw new Error('No login.access_token');
            }
            // logger('client after login', client);
            const token = login.access_token;
            const matrixClient = await sdk.createClient({
                baseUrl,
                accessToken: token,
                userId,
            });
            logger(`createClient OK BaseUrl: ${baseUrl}, userId: ${userId}, password: ${password}`);
            // logger('matrixClient', matrixClient);
            logger('Started connect to matrixClient');
            return matrixClient;
        } catch (err) {
            logger(`createClient error. BaseUrl: ${baseUrl}, userId: ${userId}, password: ${password}`);
            // logger(err);
            throw err;
        }
    };
    
    it('test matrix true config connect from sdk-client', async () => {
        const client = await createClient(config.matrix);
        await client.startClient();
        logger('client', client);
        assert.ok(client.clientRunning);
        await client.stopClient();
        logger('client', client.getSyncState());
        assert.ifError(client.clientRunning);
    });
});