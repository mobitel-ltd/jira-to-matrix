const ramda = require('ramda');
const MessengerAbstract = require('./messenger-abstract');

module.exports = class ChatFasade extends MessengerAbstract {
    /**
     * Fasade for messenger chats to handle multiple chat bots
     * @param {MessengerApi[]} chatPool - array of messenger instances
     */
    constructor(chatPool) {
        super();
        this.chatPool = chatPool;
        this.worker = ramda.last(chatPool);
    }

    /**
     * @returns {string|undefined} room alias
     */
    getInfoRoom() {
        const { infoRoom } = this.worker.config;

        return infoRoom && infoRoom.name;
    }

    /**
     * @returns {string[]} users which should be informed
     */
    getInfoUsers() {
        const { infoRoom } = this.worker.config;
        const users = (infoRoom && infoRoom.users) || this.worker.getAdmins();

        return users.map(item => this.getChatUserId(item));
    }

    /**
     * Get bot which will create new room for new hooks
     * @returns {MessengerApi} - chat bot
     */
    getCurrentClient() {
        return this.worker;
    }

    /**
     * Get bot which joined to room in chat
     * @param {string} roomId chat room id
     * @param {MessengerApi[]} clientPool array of messenger api instance
     * @returns {MessengerApi} chat bot instance
     */
    async _getTargetClient(roomId, clientPool = this.chatPool.slice().reverse()) {
        const [client, ...restClients] = clientPool;
        if (!client) {
            throw new Error(`No bot in room with id = ${roomId}`);
        }
        const status = client.isConnected() && (await client.isInRoom(roomId));

        return status ? client : this._getTargetClient(roomId, restClients);
    }

    /**
     * Get room id, throws if no bot is in room
     * @param {string} key - name of room
     * @returns {Promise<string>} - returns roomId of this room
     */
    async getRoomIdForJoinedRoom(key) {
        const roomId = await this.getRoomId(key);
        await this._getTargetClient(roomId);

        return roomId;
    }

    /**
     * Get room id
     * @param {string} roomName - name of room
     * @returns {Promise<string>} - chat room id
     */
    getRoomId(roomName) {
        return this.worker.getRoomId(roomName);
    }

    /**
     * Get room members
     * @param {{roomId: (string|undefined), name: string}} data - chat room id and name
     * @returns {Promise<string[]>} - chat room members
     */
    async getRoomMembers(data) {
        const id = data.roomId || (await this.getRoomId(data.name));
        const client = await this._getTargetClient(id);

        return client.getRoomMembers(data);
    }

    /**
     * Invite user to chat
     * @param {string} roomId - chat room id
     * @param {string} userId - chat user id
     * @returns {Promise<boolean>} true if user invited
     */
    async invite(roomId, userId) {
        const client = await this._getTargetClient(roomId);

        return client.invite(roomId, userId);
    }

    /**
     * Send message to chat room
     * @param  {string} roomId chat room id
     * @param  {string} body chat info message body
     * @param  {string} htmlBody chat message body
     * @returns {Promise<void>} void
     */
    async sendHtmlMessage(roomId, body, htmlBody = body) {
        const client = await this._getTargetClient(roomId);

        return client.sendHtmlMessage(roomId, body, htmlBody);
    }

    /**
     * @param {string} roomName room name
     * @returns {Promise<string>} return room id of created room
     */
    async getOrCreateNotifyRoom(roomName) {
        const worker = this.chatPool.find(item => item.isConnected());
        const roomId = await worker.getRoomIdByName(roomName);
        if (roomId) {
            return roomId;
        }

        const inviteUsers = this.getInfoUsers();

        const options = {
            invite: inviteUsers,
            name: roomName,
            room_alias_name: roomName,
        };

        const createdRoomId = await worker.createRoom(options);
        await worker.setRoomJoinedByUrl(createdRoomId);

        return createdRoomId;
    }

    /**
     * @param {string} text message
     * @returns {boolean} notified or not
     */
    async sendNotify(text) {
        try {
            const infoRoomName = this.getInfoRoom();
            if (infoRoomName) {
                const roomId = await this.getOrCreateNotifyRoom(infoRoomName);
                await this.inviteInfoWatchers();

                await this.sendHtmlMessage(roomId, text);

                return true;
            }
            return false;
        } catch (error) {
            this.worker.logger.error('Error in sending notify message');
            this.worker.logger.error(error);
        }
    }

    /**
     * Transform ldap user name to chat user id
     * @param {String} shortName shortName of user from ldap
     * @returns {String} user in chat format
     */
    getChatUserId(shortName) {
        return this.worker.getChatUserId(shortName);
    }

    /**
     * Get bot which joined to room in chat
     * @param {string} roomId chat room id
     * @param {string} url new avatar url
     * @returns {Promise<void>} void
     */
    async setRoomAvatar(roomId, url) {
        const client = await this._getTargetClient(roomId);

        return client.setRoomAvatar(roomId, url);
    }

    /**
     * Invite watchers to info room
     */
    async inviteInfoWatchers() {
        try {
            const alias = this.getInfoRoom();
            if (alias) {
                const connectedClient = this.getCurrentClient();
                const roomId = await connectedClient.getRoomId(alias);
                const inviteUsers = this.getInfoUsers();
                await Promise.all(inviteUsers.map(user => this.invite(roomId, user)));
            }
        } catch (error) {
            this.worker.logger.error('Error iviting watchers to info room');
            this.worker.logger.error(error);
        }
    }

    /**
     * Get bot instance
     * @param {string} id bot id
     * @returns {MessengerApi} bot instance
     */
    getInstance(id) {
        const worker = this.chatPool.find(item => item.getUserId() === id);

        return worker;
    }

    /**
     * @param {string} userId bot userId
     */
    async joinBotToInfoRoom(userId) {
        const roomInfo = this.getInfoRoom();
        if (roomInfo) {
            const bot = this.getInstance(userId);

            await bot.joinRoom({ aliasPart: roomInfo });
        }
    }
};
