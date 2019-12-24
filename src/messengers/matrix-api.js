/* eslint-disable no-undefined */
/* eslint no-empty-function: ["error", { "allow": ["arrowFunctions"] }] */
const matrixSdk = require('matrix-js-sdk');
const utils = require('../lib/utils');
const MessengerAbstract = require('./messenger-abstract');

const getEvent = content => ({
    getType: () => 'm.room.power_levels',
    getContent: () => content,
});

const defaultLogger = {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
};

module.exports = class Matrix extends MessengerAbstract {
    /**
     * Matrix-sdk fasade for bot building
     * @param  {Object} options api options
     * @param  {Object} options.config config object
     * @param  {Object} options.sdk=matrixSdk} matrix sdk lib, by default - https://github.com/matrix-org/matrix-js-sdk
     * @param  {Object} options.commandsHandler matrix event commands
     * @param  {Object} options.logger logger, winstone type, if no logger is set logger is off
     */
    constructor({ config, sdk = matrixSdk, commandsHandler, logger = defaultLogger }) {
        super();
        this.commandsHandler = commandsHandler;
        this.config = config;
        this.sdk = sdk;
        // TODO: delete EVENT_EXCEPTION check in errors after resolving 'no-event' bug
        this.EVENT_EXCEPTION = 'Could not find event';
        this.MESSAGE_TO_LARGE = 'event too large';
        this.baseUrl = `https://${config.domain}`;
        this.userId = `@${config.user}:${config.domain}`;
        this.BOT_OUT_OF_ROOM_EXEPTION = `User ${this.userId} not in room`;
        this.USER_ALREADY_IN_ROOM = 'is already in the room';
        this.postfix = `:${config.domain}`.length;
        this.logger = logger;
    }

    /**
     * Transform ldap user name to matrix user id
     * @param {String} shortName shortName of user from ldap
     * @returns {String} matrix user id like @ii_ivanov:matrix.example.com
     */
    getChatUserId(shortName) {
        return `@${shortName.toLowerCase()}:${this.config.domain}`;
    }

    /**
     * Matrix events handler
     * @param {Object} event from matrix
     * @param {Object} room matrix room
     * @param {Boolean} toStartOfTimeline true if skip event
     */
    async timelineHandler(event, room, toStartOfTimeline) {
        try {
            if (event.getType() !== 'm.room.message' || toStartOfTimeline) {
                return;
            }

            const sender = utils.getNameFromMatrixId(event.getSender());

            const { body } = event.getContent();

            const { commandName, bodyText } = utils.parseEventBody(body);

            if (!commandName) {
                return;
            }

            const roomName = utils.getNameFromMatrixId(room.getCanonicalAlias());
            const options = {
                chatApi: this,
                sender,
                roomName,
                roomId: room.roomId,
                commandName,
                bodyText,
            };

            await this.commandsHandler(options);
        } catch (err) {
            this.logger.error('Error while handling event from Matrix', err, event, room);
        }
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
        return (
            err.message.includes(this.EVENT_EXCEPTION) ||
            err.message.includes(this.BOT_OUT_OF_ROOM_EXEPTION) ||
            err.message.includes(this.MESSAGE_TO_LARGE) ||
            err.message.includes(this.USER_ALREADY_IN_ROOM)
        );
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
            const { access_token: accessToken } = await client.loginWithPassword(this.userId, this.config.password);
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
            this.client.startClient({ initialSyncLimit: 1 });

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
            !this.config.admins.includes(sender) &&
            sender !== this.config.user &&
            event.getStateKey() === this.userId
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

        this.client.on('Room.timeline', this.timelineHandler.bind(this));

        this.client.on('sync', (state, prevState, data) => {
            this._removeListener('Room.timeline', this.timelineHandler, this.client);
            this._removeListener('event', this._inviteBot.bind(this), this.client);

            if (state !== 'SYNCING' || prevState !== 'SYNCING') {
                this.logger.warn(`state: ${state}`);
                this.logger.warn(`prevState: ${prevState}`);
            }
        });

        this.client.on('RoomMember.membership', async (event, member) => {
            if (member.membership === 'invite' && member.userId === this.userId) {
                try {
                    await this.client.joinRoom(member.roomId);
                    this.logger.info(`${this.userId} joined to room with id = ${member.roomId}`);
                } catch (error) {
                    this.logger.error(`Error joining to room with id = ${member.roomId}`);
                }
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
            return true;
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
     * @param {Object} options create room options
     * @param {string}  options.room_alias_name alias for room
     * @param {string[]} options.invite array of users to invite
     * @param {string} options.name room name
     * @param {string} options.topic room topic
     * @param {string?} options.avatarUrl avatar url for room, optional
     * @returns {string} matrix room id
     */
    async createRoom({ invite, ...options }) {
        try {
            const lowerNameList = invite.map(name => name.toLowerCase());
            const createRoomOptions = {
                ...options,
                visibility: 'private',
                invite: lowerNameList,
            };
            const { room_id: roomId } = await this.client.createRoom(createRoomOptions);

            if (options.avatarUrl) {
                await this.setRoomAvatar(roomId, options.avatarUrl);
            }

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
            const { room_id: roomId } = await this.client.getRoomIdForAlias(this._getMatrixRoomAlias(alias));
            return roomId;
        } catch (err) {
            throw [`${utils.NO_ROOM_PATTERN}${alias}${utils.END_NO_ROOM_PATTERN}`, err].join('\n');
        }
    }

    /**
     * Get matrix room by alias
     * @param  {string?} name matrix room alias
     * @param  {string?} roomId matrix roomId
     * @returns {Promise<String[]>} matrix room members
     */
    async getRoomMembers({ name, roomId }) {
        try {
            const id = roomId || (await this.getRoomId(name));
            const room = await this.client.getRoom(id);
            const joinedMembers = room.getJoinedMembers();

            return joinedMembers.map(({ userId }) => userId);
        } catch (err) {
            throw [`Error while getting matrix members from room ${name}`, err].join('\n');
        }
    }

    /**
     * Check if user is in matrix room
     * @param {String} roomId matrix room id
     * @param {String} user matrix user id
     * @returns {Promise<Boolean>} return true if user in room
     */
    async isRoomMember(roomId, user) {
        const roomMembers = await this.getRoomMembers({ roomId });
        return roomMembers.includes(user);
    }

    /**
     * Invite user to matrix room
     * @param  {string} roomId matrix room id
     * @param  {string} userId matrix user id
     */
    async invite(roomId, userId) {
        try {
            const user = userId.toLowerCase();
            if (await this.isRoomMember(roomId, user)) {
                this.logger.warn(`Room ${roomId} already has user ${user}`);

                return false;
            }
            await this.client.invite(roomId, user);

            return true;
        } catch (err) {
            if (this._isEventExeptionError(err)) {
                return false;
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

                return;
            }

            throw ['Error in sendHtmlMessage', err].join('\n');
        }
    }

    /**
     * Create alias for the room
     * @param  {string} name matrix room name
     * @param  {string} roomId matrix room id
     */
    async createAlias(name, roomId) {
        const newAlias = this._getMatrixRoomAlias(name);
        try {
            await this.client.createAlias(newAlias, roomId);

            return newAlias;
        } catch (err) {
            if (err.message.includes(`Room alias ${newAlias} already exists`)) {
                this.logger.warn(err.message);

                return false;
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

                return false;
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

    /**
     * Chack if it's room name
     * @param {String} room room full or short name
     * @returns {Boolean} return true if it's matrix room name
     */
    _isRoomAlias(room) {
        return room.includes(this.config.domain) && room[0] === '#';
    }

    /**
     * Get room id by name
     * @param {String} text roomname or alias
     * @returns {Promise<String|false>} returns roomId or false if not exisits
     */
    async getRoomIdByName(text) {
        try {
            const alias = this._isRoomAlias(text) ? text : this._getMatrixRoomAlias(text.toUpperCase());
            const { room_id: roomId } = await this.client.getRoomIdForAlias(alias);

            return roomId;
        } catch (err) {
            // this.logger.warn(err);
            this.logger.warn('No room id by alias ', text);
            return false;
        }
    }

    /**
     * compose room name for matrix
     * @param {String} key Jira issue key
     * @param {String} summary Jira issue summary
     * @returns {String} room name for jira issue in matrix
     */
    composeRoomName(key, summary) {
        return `${key} ${summary}`;
    }

    /**
     * Update room name
     * @param  {string} roomId matrix room id
     * @param  {Object} roomData issue data
     * @param  {String} roomData.key jira issue key
     * @param  {String} roomData.summary jira issue summary
     * @returns {Promise<void>} update room data
     */
    async updateRoomName(roomId, roomData) {
        const newName = this.composeRoomName(roomData.key, roomData.summary);
        await this.setRoomName(roomId, newName);
    }

    /**
     * Update room info data
     * @param  {string} roomId room id
     * @param  {String} topic new room topic
     * @param  {String} key new issue key
     * @returns {Promise<void>} void
     */
    async updateRoomData(roomId, topic, key) {
        await this.createAlias(key, roomId);
        await this.setRoomTopic(roomId, topic);
    }

    /**
     * Check if user is in room
     * @param {string} roomId room id
     * @returns {boolean} return true if user in this room
     */
    async isInRoom(roomId) {
        const room = await this.client.getRoom(roomId);

        return Boolean(room);
    }

    /**
     * Get bot which joined to room in chat
     * @param {string} roomId chat room id
     * @param {string} url new avatar url
     * @returns {Promise<void>} void
     */
    async setRoomAvatar(roomId, url) {
        try {
            const method = 'PUT';
            const path = `/rooms/${encodeURIComponent(roomId)}/state/m.room.avatar`;
            const body = { url };

            await this.client._http.authedRequest(undefined, method, path, {}, body);

            return true;
        } catch (error) {
            this.logger.error(`Error in avatar setting for roomId ${roomId} with avatar url ${url}`);
            this.logger.error(error);
        }
    }
};
