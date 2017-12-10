const logger = require('debug')('matrix sdk client');
global.Olm = require('olm');
const sdk = require('matrix-js-sdk');
const {matrix} = require('../config');

/** Matrix connection handle */
class Matrix {
    /**
     * @param {class} client The first number.
     */
    constructor(client = null) {
        this.config = matrix;

        this.client = client;
        this.reconnectTimer = null;
        this.clientInitialized = false;
    }

    // /**
    //  * @returns {void} MatrixClient class
    //  */
    // async init() {
    //     try {
    //         const client = await this.createClient(this.config);
    //         logger('this.client', client);
    //         return new Matrix(client);
    //     } catch (error) {
    //         throw (`AAAAAAAAAAAAA!!!`);
    //     }
    // }

    // Можно составить дефолтное значение в baseUrl, чтобы не получать ошибку на этапе подключения к матриксу

    /**
     * @param {string} baseUrl The first number.
     * @param {string} userId The first number.
     * @param {string} password The first number.
     * @returns {void} MatrixClient class
     */
    async createClient({baseUrl = null, userId, password}) {
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
            this.client = matrixClient;
            return matrixClient;
        } catch (err) {
            logger(`createClient error. BaseUrl: ${baseUrl}, userId: ${userId}, password: ${password}`);
            throw err;
        }
    }

    /**
     * @returns {Boolean} connect status
     */
    isConnected() {
        return Boolean(this.client.clientRunning);
    }

    /**
     * @returns {Promise} connected MatrixClient
     */
    async connect() {
        try {
            await this.createClient(this.config);
            const executor = resolve => {
                const syncHandler = state => {
                    if (state === 'SYNCING') {
                        logger('well connected');
                        resolve(this.client);
                    } else {
                        this.client.once('sync', syncHandler);
                    }
                };
                this.client.once('sync', syncHandler);
            };
            this.client.startClient();
            return new Promise(executor);
        } catch (err) {
            logger('Error in Matrix connection');

            throw err;
        }
    }

    /**
     * @returns {void} disconnected MatrixClient
     */
    disconnect() {
        this.client.stopClient();
        logger('Disconnected from Matrix');
    }
}

// class constructor allows missing @returns tag
/**
 * Represents a sum.
 */
module.exports = new Matrix();

// Проверка состояния клиента
// const createClient = async ({baseUrl = null, userId, password}) => {
//     try {
//         if (!baseUrl) {
//             throw new Error('No baseUrl');
//         }

//         // Создает сущность класса MatrixClient http://matrix-org.github.io/matrix-js-sdk/0.8.5/module-client-MatrixClient.html
//         const client = sdk.createClient(baseUrl);

//         // http://matrix-org.github.io/matrix-js-sdk/0.8.5/module-base-apis-MatrixBaseApis.html
//         // в случае аутентификации возвращает объект типа { login: { access_token, home_server, user_id, device_id } }
//         const login = await client.loginWithPassword(userId, password);
//         if (!login.access_token) {
//             throw new Error('No login.access_token');
//         }

//         const token = login.access_token;
//         const matrixClient = sdk.createClient({
//             baseUrl,
//             accessToken: token,
//             userId,
//         });
//         logger(`createClient OK BaseUrl: ${baseUrl}, userId: ${userId}, password: ${password}`);
//         logger('Started connect to matrixClient');

//         return matrixClient;
//     } catch (err) {
//         logger(`createClient error. BaseUrl: ${baseUrl}, userId: ${userId}, password: ${password}`);

//         throw err;
//     }
// };

// const init = async config => {
//     try {
//         const client = await createClient(config);

//         const connect = () => {
//             const executor = resolve => {
//                 const syncHandler = state => {
//                     if (state === 'SYNCING') {
//                         logger('well connected');
//                         resolve(client);
//                     } else {
//                         client.once('sync', syncHandler);
//                     }
//                 };
//                 client.once('sync', syncHandler);
//             };
//             client.startClient();
//             return new Promise(executor);
//         };

//         const disconnect = () => {
//             logger('Disconnected from Matrix');
//             client.stopClient();
//         };

//         return {
//             connect,
//             disconnect,
//         };
//     } catch (err) {
//         logger('Matrix client not returned');
//         throw err;
//     }
// };

// module.exports = init;
