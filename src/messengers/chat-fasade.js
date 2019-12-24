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
    async _getTargetClient(roomId, clientPool = this.chatPool) {
        const [client, ...restClients] = clientPool;
        if (!client) {
            throw new Error(`No bot in room with id = ${roomId}`);
        }
        const status = await client.isInRoom(roomId);
        return status ? client : this._getTargetClient(roomId, restClients);
    }

    /**
     * Get room id
     * @param {string} data - name of room
     * @returns {Promise<string>} - chat room id
     */
    getRoomId(data) {
        return this.worker.getRoomId(data);
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
    async sendHtmlMessage(roomId, body, htmlBody) {
        const client = await this._getTargetClient(roomId);

        return client.sendHtmlMessage(roomId, body, htmlBody);
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
};
