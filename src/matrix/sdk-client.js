const logger = require('debug')('matrix sdk client');
const sdk = require('matrix-js-sdk');

// await-to helper
// based on https://github.com/scopsy/await-to-js

// Можно составить дефолтное значение в baseUrl, чтобы не получать ошибку на этапе подключения к матриксу
const createClient = async ({baseUrl, userId, password}) => {
    try {
        // Создает сущность класса MatrixClient http://matrix-org.github.io/matrix-js-sdk/0.8.5/module-client-MatrixClient.html
        const client = await sdk.createClient(baseUrl);
        // logger('client', client);
        // http://matrix-org.github.io/matrix-js-sdk/0.8.5/module-base-apis-MatrixBaseApis.html
        // в случае аутентификации возвращает объект типа { login: { access_token, home_server, user_id, device_id } }
        const login = await client.loginWithPassword(userId, password);
        logger('login', login);
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
        logger(err);
        return false;
    }
};

const addToNow = ms => new Date(Number(new Date()) + ms);

const initConnectionStore = ({tokenTTL}) => {
    // logger('tokenTTL', tokenTTL);

    const initialState = () => ({
        // could be actual client or Promise
        client: null,
        expires: null,
    });

    const state = initialState();

    const getState = () => state;

    const setState = newState => Object.assign(state, newState);

    const clearState = () => setState(initialState());

    const getClient = () => {
        const {client} = getState();
        return client;
    };

    const setNewClient = client => {
        const expires = addToNow(tokenTTL * 1000);
        setState({client, expires});
    };

    const clientExpired = () => {
        const {expires} = getState();
        return expires
            && (new Date()) > expires;
    };

    return {getClient, setNewClient, clientExpired, clearState};
};

const initConnector = config => {
    const store = initConnectionStore(config);
    // logger('Store', store);
    const connect = async () => {
        const client = store.getClient();

        if (client && !store.clientExpired()) {
            return client;
        }
        if (store.clientExpired()) {
            await disconnect(); // eslint-disable-line no-use-before-define
        }
        store.setNewClient(createClient(config));
        return store.getClient();
    };

    const disconnect = async () => {
        // Client can be a promise yet
        const client = await store.getClient();
        if (client) {
            await client.stopClient();
            logger('Disconnected from Matrix');
            store.clearState();
        }
    };

    return {connect, disconnect};
};

const wellConnected = syncState => ['PREPARED', 'SYNCING'].includes(syncState);

const init = config => {
    const connector = initConnector(config);
    // logger('Connector in Matrix.init', Object.values(connector));

    const connect = async () => {
        const client = await connector.connect();
        // logger('client', client);
        if (!client) {
            logger('Matrix client not returned');
            return;
        }
        if (wellConnected(client.getSyncState())) {
            return client;
        }

        const executor = resolve => {
            const onTimeout = () => {
                logger('Error: Timeout awaiting matrix client prepared');
                client.removeAllListeners('sync');
                resolve(undefined);
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
    };

    return {
        connect,
        disconnect: connector.disconnect,
    };
};

module.exports = init;
