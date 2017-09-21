const sdk = require('matrix-js-sdk');

let logger;

// await-to helper
// based on https://github.com/scopsy/await-to-js
function to(promise) {
    return promise
        .then(data => [null, data])
        .catch(err => [err]);
}

async function getAccessToken({baseUrl, userId, password}) {
    const [err, login] = await to(
        sdk
            .createClient(baseUrl)
            .loginWithPassword(userId, password)
    );
    if (err) {
        logger.error(`Error while requesting token:\n${err}`);
        return undefined;
    }
    return login.access_token;
}

async function createClient({baseUrl, userId, password}) {
    const token = await getAccessToken({baseUrl, userId, password});
    if (!token) {
        return undefined;
    }
    const newClient = sdk.createClient({
        baseUrl,
        accessToken: token,
        userId,
    });
    logger.info('Started connect to Matrix');
    return newClient;
}

function addToNow(ms) {
    return new Date(Number(new Date()) + ms);
}

function initConnectionStore({tokenTTL}) {
    const initialState = () => ({
        client: undefined, // could be actual client or Promise
        expires: undefined,
    });

    const state = initialState();

    function getState() {
        return state;
    }

    function setState(newState) {
        Object.assign(state, newState);
    }

    function clearState() {
        setState(initialState());
    }

    function getClient() {
        const {client} = getState();
        return client;
    }

    function setNewClient(client) {
        const expires = addToNow(tokenTTL * 1000);
        setState({client, expires});
    }

    function clientExpired() {
        const {expires} = getState();
        return expires
            && (new Date()) > expires;
    }

    return {getClient, setNewClient, clientExpired, clearState};
}

function initConnector(config) {
    const store = initConnectionStore(config);

    async function connect() {
        const client = store.getClient();
        if (client && !store.clientExpired()) {
            return client;
        }
        if (store.clientExpired()) {
            await disconnect(); // eslint-disable-line no-use-before-define
        }
        // store.setNewClient(createClient(config));
        return store.getClient();
    }

    async function disconnect() {
        const client = await store.getClient(); // Client can be a promise yet
        if (client) {
            await client.stopClient();
            logger.warn('Disconnected from Matrix');
            store.clearState();
        }
    }

    return {connect, disconnect};
}

function init(config, pLogger = console) {
    logger = pLogger;
    const connector = initConnector(config);

    function wellConnected(syncState) {
        return ['PREPARED', 'SYNCING'].includes(syncState);
    }

    async function connect() {
        const client = await connector.connect();
        if (!client) {
            return undefined;
        }
        if (wellConnected(client.getSyncState())) {
            return client;
        }

        const executor = resolve => {
            const onTimeout = () => {
                logger.error('Error: Timeout awaiting matrix client prepared');
                resolve(undefined);
            };
            const timeout = setTimeout(onTimeout, config.syncTimeoutSec * 1000);

            function onSync(state) {
                if (wellConnected(state)) {
                    clearTimeout(timeout);
                    logger.info('Client properly synched with Matrix');
                    resolve(client);
                } else {
                    client.once('sync', onSync);
                }
            }

            client.once('sync', onSync);
        };
        if (!client.clientRunning) {
            client.startClient();
        }
        return new Promise(executor);
    }

    return {
        connect,
        disconnect: connector.disconnect,
    };
}

module.exports = init;
