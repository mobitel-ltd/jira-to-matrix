const logger = require('../modules/log.js')(module);
// Matrix requirement  https://github.com/matrix-org/matrix-js-sdk#end-to-end-encryption-support
global.Olm = require('olm');
const sdk = require('matrix-js-sdk');
const {matrix} = require('../config');
const apiClient = require('./api-client');


/** Matrix connection handle */
class Matrix {
    /**
     * @param {class} client The first number.
     */
    constructor() {
        this.config = matrix;

        this.client = null;
    }

    /**
     * @private 
     * @param {string} baseUrl from config.
     * @param {string} userId from config.
     * @param {string} password from config.
     * @returns {void} MatrixClient class
     */
    async _createClient({baseUrl = null, userId, password}) {
        try {
            if (!baseUrl) {
                throw new Error('No baseUrl');
            }
            // Create instance of MatrixClient http://matrix-org.github.io/matrix-js-sdk/0.8.5/module-client-MatrixClient.html
            const client = sdk.createClient(baseUrl);
            // http://matrix-org.github.io/matrix-js-sdk/0.8.5/module-base-apis-MatrixBaseApis.html
            // в случае аутентификации возвращает объект типа { login: { access_token, home_server, user_id, device_id } }
            const {access_token: accessToken} = await client.loginWithPassword(userId, password);
            if (!accessToken) {
                throw new Error('No access_token');
            }
            const matrixClient = sdk.createClient({
                baseUrl,
                accessToken,
                userId,
            });
            logger.debug(`createClient OK BaseUrl: ${baseUrl}, userId: ${userId}, password: ${password}`);
            logger.info('Started connect to matrixClient');
            this.client = matrixClient;
        } catch (err) {
            logger.error(`createClient error. BaseUrl: ${baseUrl}, userId: ${userId}, password: ${password}`);
            throw err;
        }
    }

    /**
     * @private
     * @param {string} resolve from config.
     * @returns {void} emit sync when state of client is correct
     */
    _executor(resolve) {
        const syncHandler = state => {
            if (state === 'SYNCING') {
                logger.info('well connected');
                resolve(this.client);
            } else {
                this.client.once('sync', syncHandler);
            }
        };
        this.client.once('sync', syncHandler);
    }

    /**
     * @private
     * @returns {Promise} connected MatrixClient
     */
    async _getClient() {
        try {
            await this._createClient(this.config);
            this.client.startClient();
            return new Promise(this._executor.bind(this));
        } catch (err) {
            logger.error('Error in Matrix connection');

            throw err;
        }
    }

    /**
     * @returns {Boolean} connect status
     */
    isConnected() {
        if (this.client) {
            return Boolean(this.client.clientRunning);
        }
        logger.error('Matrix client is not initialized');
        return false;
    }

    /**
     * @returns {Class} connected MatrixClient with api for Jira
     */
    async connect() {
        await this._getClient();
        const result = await apiClient(this.client);
        return result;
    }

    /**
     * @returns {void} disconnected MatrixClient
     */
    disconnect() {
        if (this.isConnected()) {
            this.client.stopClient();
            logger.info('Disconnected from Matrix');
        }
    }
}

module.exports = new Matrix();
