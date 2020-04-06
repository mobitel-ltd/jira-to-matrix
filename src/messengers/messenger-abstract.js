/* eslint no-empty-function: off */

module.exports = class {
    /**
     * Create room name for chat
     * @abstract
     * @param {String} key Jira issue key
     * @param {String}  summary Jira issue summary
     * @returns {String} room name in chat
     */
    composeRoomName(key, summary) {}

    /**
     * Transform ldap user name to chat user id
     * @abstract
     * @param {String} shortName shortName of user from ldap
     * @returns {String} user in chat format
     */
    getChatUserId(shortName) {}

    /**
     * @abstract
     * @returns {Boolean} connect status
     */
    isConnected() {}

    /**
     * Get room id by name
     * @abstract
     * @async
     * @param {String} name roomname or alias
     * @returns {Promise<String|false>} returns roomId or false if not exisits
     */
    async getRoomIdByName(name) {}

    /**
     * Set new topic for matrix room
     * @abstract
     * @async
     * @param  {string} roomId chat room id
     * @param  {string} topic chat room topic
     * @returns {Promise<boolean>} returns true if setting succedded
     */
    async setRoomTopic(roomId, topic) {}

    /**
     * Set new name for chat room
     * @param  {string} roomId chat room id
     * @param  {string} name new room name
     * @returns {Promise<boolean>} returns true if setting succedded
     */
    async setRoomName(roomId, name) {}

    /**
     * @abstract
     * @async
     * @returns {Promise<this>} connected to Chat Client
     */
    async connect() {}

    /**
     *  disconnected Chat client
     * @returns {void}
     */
    disconnect() {}

    /**
     * Set power level for current user in chat room
     * @abstract
     * @async
     * @param  {string} roomId chat room id
     * @param  {string} userId chat user id
     * @returns {Promise<boolean>} return true if request suceedded
     */
    async setPower(roomId, userId) {}

    /**
     * Create chat room
     * @abstract
     * @async
     * @param {Object} options create room options
     * @param {string}  options.room_alias_name alias for room
     * @param {string[]} options.invite array of users to invite
     * @param {string} options.name room name
     * @param {string} options.topic room topic
     * @param {string} options.purpose issue summary
     * @param {string?} options.avatarUrl avatar url for room, optional
     * @returns {Promise<String>} chat room id
     */
    async createRoom(options) {}

    /**
     * Get chat room id by alias
     * @abstract
     * @async
     * @param  {string} name chat room name
     * @returns {Promise<String>} chat room id
     * @throws throw error if no room is found
     */
    async getRoomId(name) {}

    /**
     * Get chat room by name or id
     * @abstract
     * @async
     * @param {Object} options create room options
     * @param  {string?} options.name chat room name
     * @param  {string?} options.roomId chat roomId
     * @returns {Promise<String[]>} chat room members
     */
    async getRoomMembers({ name, roomId }) {}

    /**
     * Invite user to chat room
     * @abstract
     * @async
     * @param  {string} roomId chat room id
     * @param  {string} userId chat user id
     * @returns {Promise<boolean>} return true if user invited in room
     */
    async invite(roomId, userId) {}

    /**
     * Send message to chat room
     * @abstract
     * @async
     * @param  {string} roomId chat room id
     * @param  {string} body chat info message body
     * @param  {string} htmlBody chat message body
     * @returns {Promise<void>} return void if succedded sent
     */
    async sendHtmlMessage(roomId, body, htmlBody) {}

    /**
     * Update room name
     * @abstract
     * @async
     * @param  {String} roomId room id
     * @param  {Object} roomData room name
     * @param  {String} roomData.key jira issue key
     * @param  {String} roomData.summary jira issue summary
     * @returns {Promise<void>} void
     */
    async updateRoomName(roomId, roomData) {}

    /**
     * Update room info data
     * @abstract
     * @async
     * @param  {string} roomId room id
     * @param  {String} topic new room topic
     * @param  {String} key new room key
     * @returns {Promise<void>} void
     */
    async updateRoomData(roomId, topic, key) {}

    /**
     * Check if user is in room
     * @param {string} roomId room id
     * @returns {boolean} return true if user in this room
     */
    async isInRoom(roomId) {}

    /**
     * Get bot which joined to room in chat
     * @param {string} roomId chat room id
     * @param {string} url new avatar url
     * @returns {Promise<void>} void
     */
    async setRoomAvatar(roomId, url) {}

    /**
     * @returns {string[]} list of user id of admins
     */
    getAdmins() {
        return this.config.admins;
    }

    /**
     * @returns {string} user id
     */
    getMyId() {
        return this.config.user;
    }

    /**
     * @returns {boolean} master status
     */
    isMaster() {
        return Boolean(this.config.isMaster);
    }

    /**
     * Get notify data to send messages about connections and other info data
     * @returns {{name: string, users: string[]}|undefined} info data if exists
     */
    getNotifyData() {
        return this.config.infoRoom;
    }

    /**
     * Get get command room name
     * @returns {string|undefined} info data if exists
     */
    getCommandRoomName() {
        const data = this.getNotifyData();

        return data && data.name;
    }

    /**
     * Get chat id by displayName
     * @param {string} name searching param
     */
    async getUserIdByDisplayName(name) {}

    /**
     * Get matrix room by alias
     * @param  {string?} name matrix room alias
     * @param  {string?} roomId matrix roomId
     * @returns {Promise<String[]>} matrix room members
     */
    async getRoomAdmins({ name, roomId }) {}
    /**
     * Get bot which joined to room in chat
     * @param {string} userId chat user id
     * @returns {Promise<({displayname:string, avatarUrl:string}|undefined)>} user profile info or nothing
     */
    async getUser(userId) {}

    /**
     * Get all messeges from room
     * @param {string} roomId chat room id
     * @returns {Promise<{ author: string, date: string, body: string, eventId: string }[]>} messege data
     */
    async getAllMessagesFromRoom(roomId) {}

    /**
     * Get all messeges from room
     * @param {string} roomId chat room id
     * @returns {Promise<MatrixEvent[]>} events
     */
    async getAllEventsFromRoom(roomId) {}

    /**
     * Get bot which joined to room in chat
     * @param {object} { roomId, userId } chat room id
     * @returns {Promise<void>} void
     */
    async kickUserByRoom({ roomId, userId }) {}

    /**
     * Get bot which joined to room in chat
     * @param {string} chatLink mxc link
     */
    getDownloadLink(chatLink) {}

    /**
     * Delete matrix room alias
     * @param {string} aliasPart matrix room id
     */
    deleteRoomAlias(aliasPart) {}
};
