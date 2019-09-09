/* eslint no-empty-function: off */

module.exports = class {
    /**
     * Create room name for chat
     * @abstract
     * @param {String} key Jira issue key
     * @param {String}  summary Jira issue summary
     * @returns {String} room name in chat
     */
    composeRoomName(key, summary) { }

    /**
     * Transform ldap user name to chat user id
     * @abstract
     * @param {String} shortName shortName of user from ldap
     * @returns {String} user in chat format
     */
    getChatUserId(shortName) { }

    /**
     * @abstract
     * @returns {Boolean} connect status
     */
    isConnected() { }

    /**
     * Get room id by name
     * @abstract
     * @async
     * @param {String} name roomname or alias
     * @returns {Promise<String|false>} returns roomId or false if not exisits
     */
    async getRoomIdByName(name) { }

    /**
     * Set new topic for matrix room
     * @abstract
     * @async
     * @param  {string} roomId chat room id
     * @param  {string} topic chat room topic
     * @returns {Promise<boolean>} returns true if setting succedded
     */
    async setRoomTopic(roomId, topic) { }

    /**
     * Set new name for chat room
     * @param  {string} roomId chat room id
     * @param  {string} name new room name
     * @returns {Promise<boolean>} returns true if setting succedded
     */
    async setRoomName(roomId, name) { }

    /**
     * @abstract
     * @async
     * @returns {Promise<this>} connected to Chat Client
     */
    async connect() { }

    /**
     *  disconnected Chat client
     * @returns {void}
     */
    disconnect() { }

    /**
     * Set power level for current user in chat room
     * @abstract
     * @async
     * @param  {string} roomId chat room id
     * @param  {string} userId chat user id
     * @returns {Promise<boolean>} return true if request suceedded
     */
    async setPower(roomId, userId) { }

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
     * @returns {Promise<String>} chat room id
     */
    async createRoom(options) { }

    /**
     * Get chat room id by alias
     * @abstract
     * @async
     * @param  {string} name chat room name
     * @returns {Promise<String>} chat room id
     * @throws throw error if no room is found
     */
    async getRoomId(name) { }

    /**
     * Get chat room by name or id
     * @abstract
     * @async
     * @param {Object} options create room options
     * @param  {string?} options.name chat room name
     * @param  {string?} options.roomId chat roomId
     * @returns {Promise<String[]>} chat room members
     */
    async getRoomMembers({name, roomId}) { }

    /**
     * Invite user to chat room
     * @abstract
     * @async
     * @param  {string} roomId chat room id
     * @param  {string} userId chat user id
     * @returns {Promise<boolean>} return true if user invited in room
     */
    async invite(roomId, userId) { }

    /**
     * Send message to chat room
     * @abstract
     * @async
     * @param  {string} roomId chat room id
     * @param  {string} body chat info message body
     * @param  {string} htmlBody chat message body
     * @returns {Promise<void>} return void if succedded sent
     */
    async sendHtmlMessage(roomId, body, htmlBody) { }

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
    async updateRoomName(roomId, roomData) { }

    /**
     * Update room info data
     * @abstract
     * @async
     * @param  {string} roomId room id
     * @param  {String} topic new room topic
     * @param  {String} key new room key
     * @returns {Promise<void>} void
     */
    async updateRoomData(roomId, topic, key) { }

    /**
     * Check if user is in room
     * @param {string} roomId room id
     * @returns {boolean} return true if user in this room
     */
    async isInRoom(roomId) { }
};
