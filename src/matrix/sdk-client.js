const logger = require('debug')('matrix sdk client');
const sdk = require('matrix-js-sdk');

// await-to helper
// based on https://github.com/scopsy/await-to-js

// Можно составить дефолтное значение в baseUrl, чтобы не получать ошибку на этапе подключения к матриксу
const createClient = async ({baseUrl = null, userId, password}) => {
    try {
        if (!baseUrl) {
            throw 'Now baseUrl';
        }

        // Создает сущность класса MatrixClient http://matrix-org.github.io/matrix-js-sdk/0.8.5/module-client-MatrixClient.html
        const client = await sdk.createClient(baseUrl);
        // http://matrix-org.github.io/matrix-js-sdk/0.8.5/module-base-apis-MatrixBaseApis.html
        // в случае аутентификации возвращает объект типа { login: { access_token, home_server, user_id, device_id } }
        const login = await client.loginWithPassword(userId, password);
        if (!login.access_token) {
            throw new Error('No login.access_token');
        }

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
        throw new Error(err);
    }
};

const wellConnected = syncState => ['PREPARED', 'SYNCING'].includes(syncState);

const init = config => {
    // const connector = initConnector(config);
    // logger('Connector in Matrix.init', Object.values(connector));

    const connect = async () => {
        try {
            const client = await createClient(config);
            // logger('client', client);
            if (wellConnected(client.getSyncState())) {
                throw new Error('Not well connected of matrixClient');
            }

            const executor = resolve => {
                const onTimeout = () => {
                    logger('Error: Timeout awaiting matrix client prepared');
                    client.removeAllListeners('sync');
                    resolve(null);
                };
                const timeout = setTimeout(onTimeout, config.syncTimeoutSec * 1000);

                const onSync = state => {
                    if (wellConnected(state)) {
                        clearTimeout(timeout);
                        logger('Client properly synched with Matrix');
                        resolve(client);
                    } else {
                        client.once('sync', onSync);
                    }
                };

                client.once('sync', onSync);
            };
            if (!client.clientRunning) {
                client.startClient();
            }
            return new Promise(executor);
        } catch (err) {
            logger('Matrix client not returned');
            logger(err);
            return null;
        }
    };

    const disconnect = async () => {
        const client = await createClient(config);
        // Client can be a promise yet
        await client.stopClient();
        logger('Disconnected from Matrix');
    };
    // logger('disconect', disconnect);

    return {
        connect,
        disconnect,
    };
};

module.exports = init;
