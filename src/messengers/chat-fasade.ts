import { getLogger } from '../modules/log';
import * as ramda from 'ramda';
import { MessengerApi, RoomData } from '../types';

const logger = getLogger(module);

export class ChatFasade {
    chatPool: MessengerApi[];
    worker: MessengerApi;

    constructor(chatPool: Array<MessengerApi>) {
        this.chatPool = chatPool;
        this.worker = ramda.last(chatPool)!;
    }

    getRoomLink(idOrAlias: string): string {
        return this.worker.getRoomLink(idOrAlias);
    }

    /**
     * @returns {string|undefined} room alias
     */
    getInfoRoom() {
        const infoData = this.worker.getNotifyData();

        return infoData && infoData.name;
    }

    /**
     * Update room info data
     *
     * @param  {string} roomId room id
     * @param  {string} topic new room topic
     * @param  {string} key new issue key
     * @returns {Promise<void>} void
     */
    async updateRoomData(roomId, topic, key) {
        const client = await this._getTargetClient(roomId);

        return client.updateRoomData(roomId, topic, key);
    }

    /**
     * Create alias for the room
     *
     * @param  {string} name matrix room name
     * @param  {string} roomId matrix room id
     */
    async createAlias(name, roomId) {
        const client = await this._getTargetClient(roomId);

        return client.createAlias(name, roomId);
    }

    /**
     * Update room name
     *
     * @param  {string} roomId matrix room id
     * @param  {object} roomData issue data
     * @param  {string} roomData.key jira issue key
     * @param  {string} roomData.summary jira issue summary
     * @returns {Promise<void>} update room data
     */
    async updateRoomName(roomId, roomData) {
        const client = await this._getTargetClient(roomId);

        return client.updateRoomName(roomId, roomData);
    }

    async upload(roomId, url) {
        const client = await this._getTargetClient(roomId);

        return client.upload(roomId, url);
    }

    /**
     * Set new topic for matrix room
     *
     * @param  {string} roomId matrix room id
     * @param  {string} topic matrix room topic
     */
    async setRoomTopic(roomId, topic) {
        const client = await this._getTargetClient(roomId);

        return client.setRoomTopic(roomId, topic);
    }

    /**
     * @returns {string[]} users which should be informed
     */
    getInfoUsers() {
        const infoData = this.worker.getNotifyData();
        const users = (infoData && infoData.users) || this.worker.getAdmins();

        return users.map(item => this.getChatUserId(item));
    }

    /**
     * Get bot which will create new room for new hooks
     */
    getCurrentClient(): MessengerApi {
        return this.worker;
    }

    /**
     * Get bot which joined to room in chat
     */
    async _getTargetClient(roomId: string): Promise<MessengerApi> {
        const iter = async (clientPool: MessengerApi[]) => {
            const [client, ...restClients] = clientPool;
            if (!client) {
                throw new Error(`No bot in room with id = ${roomId}`);
            }
            const status = client.isConnected() && (await client.isInRoom(roomId));

            return status ? client : iter(restClients);
        };

        return iter(this.chatPool.slice().reverse());
    }

    /**
     * Get room data and client instance in this room by roomId
     *
     * @param {string} roomId matrix room id
     * @returns {{ client: object, roomData: RoomData}} client in room and roomdata
     */
    async getRoomAndClient(roomId: string): Promise<{ client: MessengerApi; roomData: RoomData } | undefined> {
        try {
            const client = await this._getTargetClient(roomId);
            const roomData = await client.getRoomDataById(roomId);
            if (roomData) {
                return {
                    client,
                    roomData,
                };
            }
        } catch (error) {
            return undefined;
        }
    }

    /**
     * Get room id, throws if no bot is in room
     */
    getRoomDataById(roomId) {
        return this.worker.getRoomDataById(roomId);
    }

    /**
     * Get bot which joined to room in chat
     *
     * @param {string} roomId chat room id
     * @returns {Promise<void>} void
     */
    kickUserByRoom({ roomId, userId }) {
        return this.worker.kickUserByRoom({ roomId, userId });
    }

    /**
     * Get all room events
     *
     * @param {string} roomId chat room id
     * @param {number} limit=10000 event limit
     * @param limit
     * @returns {Promise<any>} void
     */
    getAllEventsFromRoom(roomId, limit = 10000) {
        return this.worker.getAllEventsFromRoom(roomId, limit);
    }

    /**
     * Get room id, throws if no bot is in room
     *
     * @param {string} key - name of room
     * @returns {Promise<string>} - return roomId of this room
     */
    async getRoomIdForJoinedRoom(key) {
        const roomId = await this.getRoomId(key);
        await this._getTargetClient(roomId);

        return roomId;
    }

    /**
     * Get room id
     *
     * @param {string} roomName - name of room
     * @returns {Promise<string>} - chat room id
     */
    getRoomId(roomName) {
        return this.worker.getRoomId(roomName);
    }

    /**
     * Get room members
     *
     * @param {{roomId: (string|undefined), name: string}} data - chat room id and name
     * @returns {Promise<string[]>} - chat room members
     */
    async getRoomMembers(data: { roomId: string; name?: string } | { roomId?: string; name: string }) {
        const id = data.roomId || (await this.getRoomId(data.name));
        const client = await this._getTargetClient(id);

        return client.getRoomMembers(data as any);
    }

    /**
     * Invite user to chat
     *
     * @param {string} roomId - chat room id
     * @param {string} userId - chat user id
     * @returns {Promise<boolean>} true if user invited
     */
    async invite(roomId, userId) {
        const client = await this._getTargetClient(roomId);

        return client.invite(roomId, userId);
    }

    /**
     * Invite user to chat
     *
     * @param {string} displayName - chat user id
     * @returns {Promise<string>} true if user invited
     */
    getUserIdByDisplayName(displayName: string): Promise<string> {
        return this.worker.getUserIdByDisplayName(displayName);
    }

    /**
     * Send message to chat room
     *
     * @param  {string} roomId chat room id
     * @param  {string} body chat info message body
     * @param  {string} htmlBody chat message body
     * @returns {Promise<void>} void
     */
    async sendHtmlMessage(roomId: string, body: string, htmlBody = body) {
        const client = await this._getTargetClient(roomId);

        return client.sendHtmlMessage(roomId, body, htmlBody);
    }

    /**
     * Send text to chat room
     *
     * @param  {string} roomId chat room id
     * @param  {string} body chat info message body
     * @param  {string} htmlBody chat message body
     * @returns {Promise<void>} void
     */
    async sendTextMessage(roomId: string, body: string) {
        const client = await this._getTargetClient(roomId);

        return client.sendTextMessage(roomId, body);
    }

    /**
     * Get get command room name
     */
    getCommandRoomName(): string | undefined {
        return this.worker.getCommandRoomName();
    }

    async getOrCreateNotifyRoom(roomName: string): Promise<string> {
        const worker = this.chatPool.find(item => item.isConnected())!;
        const roomId = await worker.getRoomIdByName(roomName);
        if (roomId) {
            return roomId;
        }

        const inviteUsers = this.getInfoUsers();

        const options = {
            invite: inviteUsers,
            name: roomName,
            // eslint-disable-next-line @typescript-eslint/camelcase
            room_alias_name: roomName,
        };

        const createdRoomId = await worker.createRoom(options);
        await worker.setRoomJoinedByUrl(createdRoomId);

        return createdRoomId;
    }

    async sendNotify(text: string): Promise<boolean | undefined> {
        try {
            logger.info(text);

            const infoRoomName = this.getInfoRoom();
            if (infoRoomName) {
                const roomId = await this.getOrCreateNotifyRoom(infoRoomName);
                await this.inviteInfoWatchers();

                await this.sendHtmlMessage(roomId, text);

                return true;
            }
            return false;
        } catch (error) {
            logger.error('Error in sending notify message');
            logger.error(error);
        }
    }

    /**
     * Transform ldap user name to chat user id
     *
     * @param {string} shortName shortName of user from ldap
     * @returns {string} user in chat format
     */
    getChatUserId(shortName) {
        return this.worker.getChatUserId(shortName);
    }

    /**
     * Get bot which joined to room in chat
     *
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
            logger.error('Error iviting watchers to info room');
            logger.error(error);
        }
    }

    /**
     * Get bot instance
     *
     * @param {string} id bot id
     * @returns {MessengerApi} bot instance
     */
    getInstance(id) {
        const worker = this.chatPool.find(item => item.getMyId() === id);

        return worker;
    }

    /**
     * Get room id by name
     *
     * @param {string} name roomname or alias
     * @param {boolean} notUpper transform to upper
     * @returns {Promise<string|false>} return roomId or false if not exisits
     */
    getRoomIdByName(name) {
        return this.worker.getRoomIdByName(name);
    }

    /**
     * @param {string} userId bot userId
     */
    async joinBotToInfoRoom(userId) {
        const roomInfo = this.getInfoRoom();
        if (roomInfo) {
            const bot = this.getInstance(userId)!;

            await bot.joinRoom({ aliasPart: roomInfo });
        }
    }

    /**
     * Get each instance of bots
     *
     * @returns {MessengerApi[]} chat instances
     */
    getAllInstance() {
        return this.chatPool;
    }

    /**
     * Disconnect each bot
     */
    disconnect() {
        this.chatPool.map(item => item.disconnect());
    }
}
