const matrixSdk = require('matrix-js-sdk');

const getEvent = content => ({
    getType: () => 'm.room.power_levels',
    getContent: () => content,
});

module.exports = class Matrix {
    /**
     * Matrix-sdk fasade for bot building
     * @param  {Object} {config config object
     * @param  {Object} sdk=matrixSdk} matrix sdk lib, by default - https://github.com/matrix-org/matrix-js-sdk
     * @param  {function} timelineHandler handler for timeline events
    //  * @param  {Boolean} loggerOn turn on logger, by default is true
     * @param  {function|undefined} logger custom logger
     */
    constructor({config, sdk = matrixSdk, timelineHandler, logger}) {
        this.timelineHandler = timelineHandler;
        this.config = config;
        this.sdk = sdk;
        // TODO: delete EVENT_EXCEPTION check in errors after resolving 'no-event' bug
        this.BOT_OUT_OF_ROOM_EXEPTION = `User ${this.config.userId} not in room`;
        this.EVENT_EXCEPTION = 'Could not find event';
        this.baseUrl = `https://${config.domain}`;
        this.userId = `@${config.user}:${config.domain}`;
        this.postfix = `:${config.domain}`.length;
        this.logger = logger;
    }

    /**
     * Convert string with alias to matrix form
     * @param  {string} alias alias for a room
     * @returns {string} alias in matrix
     */
    _getMatrixRoomAlias(alias) {
        return `#${alias}:${this.config.domain}`;
    }
    /**
     * Check if err should be ignored
     * @param  {Object} err catching error body
     * @returns {Boolean} true/false
     */
    _isEventExeptionError(err) {
        return err.message.includes(this.EVENT_EXCEPTION) || err.message.includes(this.BOT_OUT_OF_ROOM_EXEPTION);
    }


    /**
     * @private
     * @param {string} baseUrl from config.
     * @param {string} userId from config.
     * @param {string} password from config.
     * @returns {void} MatrixClient class
     */
    async _createClient() {
        try {
            const client = this.sdk.createClient(this.baseUrl);
            const {access_token: accessToken} = await client.loginWithPassword(this.userId, this.config.password);
            const matrixClient = this.sdk.createClient({
                baseUrl: this.baseUrl,
                accessToken,
                userId: this.userId,
            });

            this.logger.info(`createClient OK BaseUrl: ${this.baseUrl}, userId: ${this.userId}`);
            this.logger.info('Started connect to matrixClient');
            this.client = matrixClient;
        } catch (err) {
            throw [`createClient error. BaseUrl: ${this.baseUrl}, userId: ${this.userId}`, err].join('\n');
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
                this.logger.info('well connected');
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
    async _startClient() {
        try {
            await this._createClient();
            this.client.startClient();

            return new Promise(this._executor.bind(this));
        } catch (err) {
            throw ['Error in Matrix connection', err].join('\n');
        }
    }


    /**
     * @param  {object} event matrix event
     */
    async _inviteBot(event) {
        if (event.event.membership !== 'invite') {
            return;
        }

        let sender = event.getSender();
        sender = sender.slice(1, -this.postfix);

        if (
            !this.config.admins.includes(sender)
            && sender !== this.config.user
            && event.getStateKey() === this.userId
        ) {
            await this.client.leave(event.getRoomId());
            return;
        }

        if (event.getStateKey() === this.userId) {
            await this.client.joinRoom(event.getRoomId());
        }
    }

    /**
     * Remove listener
     * @param  {string} eventName matrix event name
     * @param  {string} listener  matrix event listener
     * @param  {object} matrixClient matrix client
     */
    _removeListener(eventName, listener, matrixClient) {
        const listCount = matrixClient.listenerCount(eventName);
        if (listCount > 1) {
            matrixClient.removeListener(eventName, listener);
            this.logger.warn(`Count listener for ${eventName} ${listCount}. To remove unnecessary listener`);
        }
    }

    /**
     * Handler to add timeline handler to watch events in a room
     * @returns {Object} matrix client
     */
    _handler() {
        if (!this.client) {
            this.logger.error('matrixclient is undefined');
            return;
        }

        this.client.on('Room.timeline', this.timelineHandler);

        this.client.on('sync', (state, prevState, data) => {
            this._removeListener('Room.timeline', this.timelineHandler, this.client);
            this._removeListener('event', this._inviteBot.bind(this), this.client);

            if (state !== 'SYNCING' || prevState !== 'SYNCING') {
                this.logger.warn(`state: ${state}`);
                this.logger.warn(`prevState: ${prevState}`);
            }
        });

        this.client.on('event', this._inviteBot.bind(this));

        return this.client;
    }

    /**
     * @returns {Object} matrix client
     */
    getClient() {
        return this.client;
    }


    /**
     * @returns {Boolean} connect status
     */
    isConnected() {
        if (this.client) {
            return !!this.client.clientRunning;
        }
        this.logger.error('Matrix client is not initialized');

        return false;
    }

    /**
     * @returns {Object} connected MatrixClient with api for Jira
     */
    async connect() {
        try {
            await this._startClient();

            return this._handler();
        } catch (err) {
            throw ['Error in Matrix connection', err].join('\n');
        }
    }

    /**
     * @returns {void} disconnected MatrixClient
     */
    disconnect() {
        if (this.isConnected()) {
            this.client.stopClient();
            this.logger.info('Disconnected from Matrix');
        }
    }

    /**
     * Set power level for current user in matrix room
     * @param  {string} roomId matrix room
     * @param  {string} userId matrix userId
     */
    async setPower(roomId, userId) {
        try {
            const content = await this.client.getStateEvent(roomId, 'm.room.power_levels', '');
            const event = getEvent(content);

            await this.client.setPowerLevel(roomId, userId, 50, event);
        } catch (err) {
            throw [`Error setting power level for user ${userId} in room ${roomId}`, err].join('\n');
        }
    }

    /**
     * Get rooms from matrix
     * @returns {array} matrix rooms
     */
    getRooms() {
        return this.client.getRooms();
    }

    /**
     * Create matrix room
     * @param  {Object} options create room options
     * @returns {string} matrix room id
     */
    async createRoom(options) {
        try {
            const {room_id: roomId} = await this.client.createRoom({visibility: 'private', ...options});
            return roomId;
        } catch (err) {
            throw ['Error while creating room', err].join('\n');
        }
    }

    /**
     * Get matrix room id by alias
     * @param  {string} alias matrix room alias
     */
    async getRoomId(alias) {
        try {
            const {room_id: roomId} = await this.client.getRoomIdForAlias(this._getMatrixRoomAlias(alias));
            return roomId;
        } catch (err) {
            throw [`No roomId for ${alias} from Matrix`, err].join('\n');
        }
    }

    /**
     * Get matrix room by alias
     * @param  {string} alias matrix room alias
     */
    async getRoomByAlias(alias) {
        try {
            const roomId = await this.getRoomId(alias);
            const room = await this.client.getRoom(roomId);
            return room;
        } catch (err) {
            this.logger.warn(`No room for alias ${alias} from Matrix\n`, err);

            return null;
        }
    }

    /**
     * Invite user to matrix room
     * @param  {string} roomId matrix room id
     * @param  {string} userId matrix user id
     */
    async invite(roomId, userId) {
        try {
            const response = await this.client.invite(roomId, userId);

            return response;
        } catch (err) {
            if (this._isEventExeptionError(err)) {
                return null;
            }

            throw ['Error while inviting a new member to a room:', err].join('\n');
        }
    }

    /**
     * Send message to matrix room
     * @param  {string} roomId matrix room id
     * @param  {string} body matrix info message body
     * @param  {string} htmlBody matrix message body
     */
    async sendHtmlMessage(roomId, body, htmlBody) {
        try {
            await this.client.sendHtmlMessage(roomId, body, htmlBody);
        } catch (err) {
            if (this._isEventExeptionError(err)) {
                this.logger.warn(err.message);

                return null;
            }

            throw ['Error in sendHtmlMessage', err].join('\n');
        }
    }

    /**
     * Create alias for the room
     * @param  {string} alias matrix room alias
     * @param  {string} roomId matrix room id
     */
    async createAlias(alias, roomId) {
        const newAlias = this._getMatrixRoomAlias(alias);
        try {
            await this.client.createAlias(newAlias, roomId);
        } catch (err) {
            if (err.message.includes(`Room alias ${newAlias} already exists`)) {
                this.logger.warn(err.message);

                return null;
            }
            this.logger.error(err);
            throw ['Error while creating alias for a room', err].join('\n');
        }
    }

    /**
     * Set new name for matrix room
     * @param  {string} roomId matrix room id
     * @param  {string} name new room name
     */
    async setRoomName(roomId, name) {
        try {
            await this.client.setRoomName(roomId, name);
            return true;
        } catch (err) {
            if (this._isEventExeptionError(err)) {
                this.logger.warn(err.message);

                return null;
            }

            throw ['Error while setting room name', err].join('\n');
        }
    }

    /**
     * Set new topic for matrix room
     * @param  {string} roomId matrix room id
     * @param  {string} topic matrix room topic
     */
    async setRoomTopic(roomId, topic) {
        try {
            await this.client.setRoomTopic(roomId, topic);
        } catch (err) {
            if (this._isEventExeptionError(err)) {
                this.logger.warn(err.message);

                return null;
            }

            throw [`Error while setting room's topic`, err].join('\n');
        }
    }
};
