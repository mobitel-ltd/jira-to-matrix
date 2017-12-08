const logger = require('debug')('matrix sdk client');
global.Olm = require('olm');
const sdk = require('matrix-js-sdk');

// Проверка состояния клиента
const createClient = async ({baseUrl = null, userId, password}) => {
    try {
        if (!baseUrl) {
            throw new Error('No baseUrl');
        }

        // Создает сущность класса MatrixClient http://matrix-org.github.io/matrix-js-sdk/0.8.5/module-client-MatrixClient.html
        const client = sdk.createClient(baseUrl);

        // http://matrix-org.github.io/matrix-js-sdk/0.8.5/module-base-apis-MatrixBaseApis.html
        // в случае аутентификации возвращает объект типа { login: { access_token, home_server, user_id, device_id } }
        const login = await client.loginWithPassword(userId, password);
        if (!login.access_token) {
            throw new Error('No login.access_token');
        }

        const token = login.access_token;
        const matrixClient = sdk.createClient({
            baseUrl,
            accessToken: token,
            userId,
        });
        logger(`createClient OK BaseUrl: ${baseUrl}, userId: ${userId}, password: ${password}`);
        logger('Started connect to matrixClient');

        return matrixClient;
    } catch (err) {
        logger(`createClient error. BaseUrl: ${baseUrl}, userId: ${userId}, password: ${password}`);

        throw err;
    }
};

const init = async config => {
    try {
        const client = await createClient(config);

        const connect = () => {
            const executor = resolve => {
                const syncHandler = state => {
                    if (state === 'SYNCING') {
                        logger('well connected');
                        resolve(client);
                    } else {
                        client.once('sync', syncHandler);
                    }
                };
                client.once('sync', syncHandler);
            };
            client.startClient();
            return new Promise(executor);
        };

        const disconnect = () => {
            logger('Disconnected from Matrix');
            client.stopClient();
        };

        return {
            connect,
            disconnect,
        };
    } catch (err) {
        logger('Matrix client not returned');
        throw err;
    }
};

module.exports = init;
