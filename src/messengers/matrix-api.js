// @ts-nocheck

/* eslint-disable no-undefined */
/* eslint no-empty-function: ["error", { "allow": ["arrowFunctions"] }] */
const matrixSdk = require('matrix-js-sdk');
const utils = require('../lib/utils');
const MessengerAbstract = require('./messenger-abstract');
const R = require('ramda');

const getEvent = content => ({
    getType: () => 'm.room.power_levels',
    getContent: () => content,
});

// eslint-disable-next-line prettier/prettier
const voidFunc = () => {};

const defaultLogger = {
    info: () => voidFunc,
    error: () => voidFunc,
    warn: () => voidFunc,
    debug: () => voidFunc,
};

module.exports = class Matrix extends MessengerAbstract {
    /**
     * Matrix-sdk fasade for bot building
     * @param  {Object} options api options
     * @param  {Object} options.config config object
     * @param  {matrixSdk} options.sdk=matrixSdk} matrix sdk lib, by default - https://github.com/matrix-org/matrix-js-sdk
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
     * @returns {string} user id
     */
    getMyId() {
        return this.config.user;
    }

    /**
     * @returns {string} matrix user id
     */
    getBotId() {
        return this.userId;
    }

    /**
     * Transform ldap user name to matrix user id
     * @param {String} shortName shortName of user from ldap
     * @returns {String} matrix user id like @ii_ivanov:matrix.example.com
     */
    getChatUserId(shortName) {
        return shortName && `@${shortName.toLowerCase()}:${this.config.domain}`;
    }

    /**
     * Get name from matrix id
     * @param {string} id matrix alias or name
     * @returns {(string|undefined)} return id
     */
    _getNameFromMatrixId(id) {
        if (id) {
            const [name] = id.split(':').slice(0, 1);

            return name.slice(1);
        }
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

            const sender = this._getNameFromMatrixId(event.getSender());

            const { body } = event.getContent();

            const { commandName, bodyText } = utils.parseEventBody(body);

            if (!commandName) {
                return;
            }

            const roomData = this.getRoomData(room);
            const roomName = roomData.alias;

            const options = {
                roomData,
                chatApi: this,
                sender,
                roomName,
                roomId: room.roomId,
                commandName,
                bodyText,
                config: this.config.baseConfig,
            };

            await this.commandsHandler(options);
        } catch (err) {
            const errMsg = utils.errorTracing(
                `Error while handling event from Matrix room "${room.name}" ${room.roomId}`,
                err,
            );
            this.logger.error(errMsg);
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
            err.message &&
            (err.message.includes(this.EVENT_EXCEPTION) ||
                err.message.includes(this.BOT_OUT_OF_ROOM_EXEPTION) ||
                err.message.includes(this.MESSAGE_TO_LARGE) ||
                err.message.includes(this.USER_ALREADY_IN_ROOM))
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
                this.connection = true;
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
     * Leave room by id
     * @param {string} roomId matrix room id
     */
    async leaveRoom(roomId) {
        try {
            await this.client.leave(roomId);
            this.logger.info(`Left room with id ${roomId}`);

            return roomId;
        } catch (err) {
            this.logger.error([`leave room ${roomId}`, err].join('\n'));

            return false;
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
                this.logger.warn(`state is ${state}, prevState is ${prevState} for bot with id ${this.config.user}`);
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
            return !!this.client.clientRunning && this.connection;
        }

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
     * @param  {number} level=50 power level, 50 by default
     */
    async setPower(roomId, userId, level = 50) {
        try {
            const content = await this.client.getStateEvent(roomId, 'm.room.power_levels', '');
            const event = getEvent(content);

            await this.client.setPowerLevel(roomId, userId, 50, event);

            this.logger.info(`Power level for room with id ${roomId} is set to ${level} for user ${userId}`);
            return true;
        } catch (err) {
            throw [`Error setting power level for user ${userId} in room ${roomId}`, err].join('\n');
        }
    }

    /**
     * @param {string} searchParam param to search
     * @returns {Promies<string|undefined>} user id in matrix if exists
     */
    async getUserIdByDisplayName(searchParam) {
        try {
            const method = 'POST';
            const path = '/user_directory/search';
            const body = {
                search_term: searchParam,
                limit: 10000,
            };

            const result = await this.client._http.authedRequest(undefined, method, path, {}, body);
            const userId = R.path(['results', 0, 'user_id'], result);

            if (!userId) {
                this.logger.warn(`Not found user by search params ${searchParam}`);
            }

            return userId;
        } catch (error) {
            this.logger.error(error);
            throw error;
        }
    }

    /**
     * Get room data
     * @param {Room} room matrix room
     * @returns {{alias: ?string, name: string, members: {userId: string, level: number}[], topic: string}} room data
     */
    getRoomData(room) {
        const lastCreatedAlias = R.head(room.getAliases()) || room.getCanonicalAlias();
        const alias = this._getNameFromMatrixId(lastCreatedAlias) || null;
        const joinedMembers = room.getJoinedMembers();
        const topicEvent = room.currentState.getStateEvents('m.room.topic', '');
        const topic = topicEvent && R.path(['topic'], topicEvent.getContent());

        return {
            id: room.roomId,
            alias,
            name: room.name,
            topic,
            members: joinedMembers.map(({ userId, powerLevel }) => ({
                userId,
                powerLevel,
            })),
        };
    }

    /**
     * Get room data by room id
     * @param {string} roomId matrix room id
     */
    async getRoomDataById(roomId) {
        const room = await this.client.getRoom(roomId);
        if (room) {
            return this.getRoomData(room);
        }
    }

    /**
     * Get rooms from matrix
     * @returns {array} matrix rooms
     */
    getRooms() {
        const getParsedRooms = room => {
            const joinedMembers = room.getJoinedMembers();

            return {
                name: room.name,
                id: room.roomId,
                members: joinedMembers.map(({ userId }) => userId),
            };
        };

        const rooms = this.client.getRooms();

        return rooms.map(getParsedRooms);
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
    async createRoom({ invite, avatarUrl, ...options }) {
        try {
            const lowerNameList = invite.filter(Boolean).map(name => name.toLowerCase());
            const createRoomOptions = {
                ...options,
                room_alias_name: options.room_alias_name.toUpperCase(),
                visibility: 'private',
                invite: lowerNameList,
            };
            const { room_id: roomId } = await this.client.createRoom(createRoomOptions);

            if (avatarUrl) {
                await this.setRoomAvatar(roomId, avatarUrl);
            }

            this.logger.info(`Room with alias "${options.name}" is created with id ${roomId}`);
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
            throw [`Error while getting matrix members from room ${name || roomId}`, err].join('\n');
        }
    }

    /**
     * Get matrix room by alias
     * @param  {string?} name matrix room alias
     * @param  {string?} roomId matrix roomId
     * @returns {Promise<{name: srting, userId: string}[]>} matrix room members
     */
    async getRoomAdmins({ name, roomId }) {
        try {
            const id = roomId || (await this.getRoomId(name));
            const room = await this.client.getRoom(id);
            const joinedMembers = room.getJoinedMembers();

            return joinedMembers
                .filter(({ powerLevel }) => powerLevel === 100)
                .map(({ name, userId }) => ({ name, userId }));
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
            this.logger.info(`New alias ${newAlias} for room with id ${roomId} is added`);

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
            this.logger.debug(`New room topic is added for room with id ${roomId}`);
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
     * @param {Boolean} notUpper transform to upper
     * @returns {Promise<String|false>} returns roomId or false if not exisits
     */
    async getRoomIdByName(text, notUpper) {
        try {
            const alias = this._isRoomAlias(text)
                ? text
                : this._getMatrixRoomAlias(notUpper ? text : text.toUpperCase());
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

    /**
     * Get bot which joined to room in chat
     * @param {string} roomId chat room id
     * @returns {Promise<void>} void
     */
    async getAllMessagesFromRoom(roomId) {
        try {
            const method = 'GET';
            const path = `/rooms/${encodeURIComponent(roomId)}/messages`;
            const qweryParams = { limit: 10000, dir: 'b' };
            const body = {};

            const { chunk } = await this.client._http.authedRequest(undefined, method, path, qweryParams, body);

            const allMessages = chunk
                .filter(({ type }) => type === 'm.room.message')
                .map(event => {
                    const { user_id: author, content, origin_server_ts: timestamp, event_id: eventId } = event;
                    const body = content.msgtype === 'm.text' && content.body;
                    const date = new Date(timestamp);

                    return { author, date, body, eventId };
                });
            return allMessages;
        } catch (error) {
            this.logger.error(`Error in request to all messages for ${roomId}.`);
            this.logger.error(error);
        }
    }

    /**
     * Get all room events
     * @param {string} roomId chat room id
     * @param {number} limit=10000 event limit
     * @returns {Promise<void>} void
     */
    async getAllEventsFromRoom(roomId, limit = 10000) {
        try {
            const method = 'GET';
            const path = `/rooms/${encodeURIComponent(roomId)}/messages`;
            const qweryParams = { limit, dir: 'b' };
            const body = {};

            const { chunk } = await this.client._http.authedRequest(undefined, method, path, qweryParams, body);

            return chunk;
        } catch (error) {
            this.logger.error(`Error in request to all events for ${roomId}.`);
            this.logger.error(error);
        }
    }

    /**
     * Get bot which joined to room in chat
     * @param {string} mxcUrl mxc link
     * @returns {string} string
     */
    getDownloadLink(mxcUrl) {
        return this.client.mxcUrlToHttp(mxcUrl);
    }

    /**
     * Get bot which joined to room in chat
     * @param {string} roomId chat room id
     * @returns {Promise<void>} void
     */
    async kickUserByRoom({ roomId, userId }) {
        try {
            const method = 'PUT';
            const path = `/rooms/${encodeURIComponent(roomId)}/state/m.room.member/${encodeURIComponent(userId)}`;
            const qweryParams = {};
            const body = { membership: 'leave', reason: 'kick by bot' };

            await this.client._http.authedRequest(undefined, method, path, qweryParams, body);
            this.logger.info(`Member ${userId} kicked from ${roomId}`);

            return userId;
        } catch (error) {
            const msg = utils.errorTracing(
                `Error in request for kick ${userId} from ${roomId}.`,
                JSON.stringify(error),
            );
            this.logger.error(msg);
        }
    }

    /**
     * @param {string} roomId room id
     */
    async setRoomJoinedByUrl(roomId) {
        try {
            const method = 'PUT';
            const path = `/rooms/${encodeURIComponent(roomId)}/state/m.room.join_rules`;
            const body = { join_rule: 'public' };

            await this.client._http.authedRequest(undefined, method, path, {}, body);

            return true;
        } catch (error) {
            this.logger.error(`Error in setting public acceess for roomId ${roomId}`);
            this.logger.error(error);
        }
    }

    /**
     * Get bot which joined to room in chat
     * @param {string} userId chat user id
     * @returns {Promise<({displayname:string, avatarUrl:string}|undefined)>} user profile info or nothing
     */
    async getUser(userId) {
        try {
            const user = await this.client.getProfileInfo(userId);

            return {
                displayName: user.displayname,
                avatarUrl: user.avatar_url,
            };
        } catch (err) {
            this.logger.error(`User profile ${userId} is not found. \nError: ${JSON.stringify(err)}`);
        }
    }

    /**
     * @param {object} options join options
     * @param {string} options.roomId room id to join
     * @param {string} options.aliasPart alias part to join
     */
    async joinRoom({ roomId, aliasPart }) {
        try {
            if (aliasPart) {
                const alias = this._getMatrixRoomAlias(aliasPart);

                await this.client.joinRoom(alias);

                return;
            }

            await this.client.joinRoom(roomId);
        } catch (err) {
            this.logger.error('Error with joining to room');
            this.logger.error(err);
        }
    }

    /**
     * Delete matrix room alias
     * @param {string} aliasPart aliasPart
     * @returns {string|undefined} return allias if command is succedded
     */
    async deleteRoomAlias(aliasPart) {
        const alias = this._getMatrixRoomAlias(aliasPart);
        try {
            const roomId = await this.getRoomIdByName(alias, true);
            if (!roomId) {
                this.logger.warn(`Alias ${alias} is not found!!!`);

                return;
            }
            await this.client.deleteAlias(alias);
            this.logger.debug(`Alias ${alias} is successfully deleted in room with id ${roomId}`);

            return alias;
        } catch (err) {
            const msg = utils.errorTracing(`deleteRoomAlias "${alias}"`, JSON.stringify(err));
            this.logger.error(msg);
        }
    }
};
