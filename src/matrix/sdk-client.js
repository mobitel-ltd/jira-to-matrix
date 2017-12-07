const logger = require('debug')('matrix sdk client');

global.Olm = require('olm');
const sdk = require('matrix-js-sdk');
// const config = require('../config/');

// // /** Matrix connection handle */
// // class ConnectToMatrix {
// //     /**
// //      * @param {number} config The first number.
// //      */
// //     constructor() {
// //         this.config = config;

// //         this.client = null;
// //         this.reconnectTimer = null;
// //         this.clientInitialized = false;

// //         (async () => {
// //             try {
// //                 // console.info(`Try Matrix initialization`);
// //                 this.client = await this.createClient(this.config);
// //                 logger('this.client', this.client);
// //             } catch (error) {
// //                 throw (`AAAAAAAAAAAAA!!!`);
// //             }
// //         })();
// //     }

// //     /**
// //      * @returns {void} MatrixClient class
// //      */
// //     // static async init() {
// //     //     try {
// //     //     // console.info(`Try Matrix initialization`);
// //     //         this.client = await this.createClient(this.config);
// //     //         logger('this.client', this.client);
// //     //     } catch (error) {
// //     //         throw (`AAAAAAAAAAAAA!!!`);
// //     //     }
// //     // }

// //     // Можно составить дефолтное значение в baseUrl, чтобы не получать ошибку на этапе подключения к матриксу

// //     async getTokenByLoginAndPassword() {
// //         const self = this;

// //         try {
// //             if (!self.client) {
// //                 throw new Error(`No Matrix client`);
// //             }

// //             const {userId, password} = self.config;
// //             const {token} = await self.client.loginWithPassword(userId, password);
// //         } catch (error) {
// //             logger(error);
// //         }
// //     }

// //     /**
// //      * @param {string} baseUrl The first number.
// //      * @param {string} userId The first number.
// //      * @param {string} password The first number.
// //      * @returns {void} MatrixClient class
// //      */
// //     async createClient({baseUrl = null, userId, password}) {
// //         const self = this;

// //         try {
// //             if (!baseUrl) {
// //                 throw new Error('No baseUrl');
// //             }

// //             // Создает сущность класса MatrixClient http://matrix-org.github.io/matrix-js-sdk/0.8.5/module-client-MatrixClient.html
// //             self.client = sdk.createClient(baseUrl);
// //             // logger('client before login', client);
// //             // http://matrix-org.github.io/matrix-js-sdk/0.8.5/module-base-apis-MatrixBaseApis.html
// //             // в случае аутентификации возвращает объект типа { login: { access_token, home_server, user_id, device_id } }
// //             const accessToken = await self.getTokenByLoginAndPassword();
// //             if (!accessToken) {
// //                 throw new Error('No login.access_token');
// //             }
// //             // logger('client after login', client);
// //             // const token = login.access_token;
// //             self.client = sdk.createClient({
// //                 baseUrl,
// //                 accessToken,
// //                 userId,
// //             });
// //             logger(`createClient OK BaseUrl: ${baseUrl}, userId: ${userId}, password: ${password}`);
// //             // logger('matrixClient', matrixClient);
// //             logger('Started connect to matrixClient');
// //             this.client = matrixClient;
// //             this.clientInitialized = true;
// //             return matrixClient;
// //         } catch (err) {
// //             logger(`createClient error. BaseUrl: ${baseUrl}, userId: ${userId}, password: ${password}`);
// //             // logger(err);
// //             throw err;
// //         }
// //     }

// //     /**
// //      * @returns {Boolean} connect status
// //      */
// //     isConnected() {
// //         return Boolean(this.client.clientRunning);
// //     }

// //     /**
// //      * @returns {class} connected MatrixClient
// //      */
// //     connect() {
// //         const self = this;

// //         if (!self.client.clientRunning && !self.reconnectTimer) {
// //             logger(`Try connection to Matrix`);
// //             self.reconnectTimer = setTimeout(() => {
// //                 self.client.startClient();
// //                 clearTimeout(self.reconnectTimer);
// //                 self.reconnectTimer = null;
// //                 logger(`Connection to Matrix established`);
// //             }, 1000);
// //         }
// //         return self.client;
// //     }

// //     /**
// //      * @returns {void} disconnected MatrixClient
// //      */
// //     disconnect() {
// //         // Client can be a promise yet    
// //         this.client.stopClient();
// //         logger('Disconnected from Matrix');
// //     }
// // }

// // class constructor allows missing @returns tag
// /**
//  * Represents a sum.
//  */
// module.exports = new ConnectToMatrix();
// await-to helper

// based on https://github.com/scopsy/await-to-js

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
        // logger('matrixClient', matrixClient);
        logger('Started connect to matrixClient');

        return matrixClient;
    } catch (err) {
        logger(`createClient error. BaseUrl: ${baseUrl}, userId: ${userId}, password: ${password}`);
        // logger(err);
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
