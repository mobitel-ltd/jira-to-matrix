/* eslint-disable no-undefined */
import http from 'http';
import Ramda from 'ramda';
import { WebClient } from '@slack/web-api';
import { fromString } from 'html-to-text';
import express from 'express';
import bodyParser, { OptionsJson } from 'body-parser';
import { BaseChatApi } from './base-api';
import { ChatConfig } from '../types';
import { LoggerInstance } from 'winston';
import { Commands } from '../bot/commands';
// import { MessengerApi } from '../types';

export class SlackApi extends BaseChatApi {
    // export class SlackApi extends BaseChatApi {
    commandServer;
    count = 0;
    client: any;

    constructor(commands: Commands, config: ChatConfig, logger: LoggerInstance, sdk: WebClient) {
        super(commands, config, logger, sdk);
        this.sdk = sdk || new WebClient(config.password);
    }

    /**
     * Transform ldap user name to Slack user id
     *
     * @param {string} shortName shortName of user from ldap
     * @returns {string} user email like ii_ivanov@ example.com
     */
    getChatUserId(shortName) {
        return shortName && `${shortName.toLocaleLowerCase()}@${this.config.messenger.domain}`;
    }

    /**
     * Leave room by id
     *
     * @param {string} roomId matrix room id
     */
    leaveRoom() {
        // TODO override
        undefined;
    }

    /**
     * Get id
     *
     * @returns {string} user id
     */
    getBotId() {
        return this.config.user;
    }

    /**
     * Slack event handler
     *
     * @param {object} eventBody slack event
     */
    async _eventHandler(eventBody) {
        try {
            const info = await this.getRoomInfo(eventBody.channel_id);
            const commandName = eventBody.command.slice(2);

            const options = {
                chatApi: this,
                sender: eventBody.user_name.replace(/[0-9]/g, ''),
                roomName: info.name.toUpperCase(),
                roomId: eventBody.channel_id,
                bodyText: eventBody.text,
            };
            //! TODO options are incorrect!!!
            await this.commands.run(commandName, options as any);
        } catch (error) {
            this.logger.error('Error while handling slash command from Slack');
        }
    }

    /**
     * Slack slash command listener
     */
    _slashCommandsListener() {
        const app = express();

        const options: OptionsJson = {
            strict: false,
        };
        app.use(bodyParser.urlencoded(options)).post('/commands', async (req, res) => {
            await this._eventHandler(req.body);
            res.send(200);
        });

        this.commandServer = http.createServer(app);
        this.commandServer.listen(this.config.messenger.eventPort, () => {
            this.logger.info(`Slack commands are listening on port ${this.config.messenger.eventPort}`);
        });
    }

    /**
     * @private
     * @returns {Promise} connected slackClient
     */
    async _startClient() {
        try {
            await this.sdk.auth.test();
            this.logger.info('Slack client started!');
            this.client = this.sdk;
        } catch (err) {
            throw ['Error in slack connection', err].join('\n');
        }
    }

    /**
     * Get bot which joined to room in chat
     *
     * @param {string} userId chat user id
     * @returns {Promise<User>} void
     */
    getUser() {
        return true;
    }

    /**
     * @returns {object} connected slackClient with api for Jira
     */
    async connect() {
        if (this.isConnected()) {
            return;
        }
        try {
            await this._startClient();
            await this._slashCommandsListener();
            return this;
        } catch (err) {
            throw ['Error in slack connection', err].join('\n');
        }
    }

    /**
     * @returns {boolean} connect status
     */
    isConnected() {
        return this.commandServer && this.commandServer.listening;
    }

    /**
     * disconnected slackClient
     */
    disconnect() {
        if (this.commandServer) {
            this.commandServer.close();
            this.logger.info('Disconnected from Slack');
        }
    }

    /**
     * Send message to Slack room
     *
     * @param  {string} channel slack room id
     * @param  {string} infoMessage info message body
     * @param  {string} textBody markdown message body
     */
    async sendHtmlMessage(channel, infoMessage, textBody) {
        try {
            const text = fromString(textBody);
            const attachments = [
                {
                    text,
                    mrkdwn_in: ['text'],
                },
            ];
            await this.client.chat.postMessage({ channel, attachments });
        } catch (err) {
            throw ['Error in sendHtmlMessage', err].join('\n');
        }
    }

    /**
     * @param  {string} email user mail
     * @returns {string|undefined} slack user id or undefined
     */
    async _getUserIdByEmail(email) {
        try {
            const userInfo = await this.client.users.lookupByEmail({ email });

            return Ramda.path(['user', 'id'], userInfo);
        } catch (error) {
            this.logger.error(`Error getting user from slack by email "${email}"`, error);
        }
    }

    /**
     * Set topic to channel
     *
     * @param  {string} channel channel id
     * @param  {string} topic new topic
     * @returns {boolean} request result
     */
    async setRoomTopic(channel, topic) {
        try {
            const res = await this.client.conversations.setTopic({ channel, topic });

            return res.ok;
        } catch (err) {
            this.logger.error(err);
            throw ['Error while setting channel topic', err].join('\n');
        }
    }

    /**
     * Set purpose to channel
     *
     * @param  {string} channel channel id
     * @param  {string} purpose new topic
     * @returns {boolean} request result
     */
    async setPurpose(channel, purpose) {
        try {
            const res = await this.client.conversations.setPurpose({ channel, purpose });

            return res.ok;
        } catch (err) {
            this.logger.error(err);
            throw ['Error while setting channel purpose', err].join('\n');
        }
    }

    /**
     * Create Slack channel
     *
     * @param  {object} options create channel options
     * @param  {string} options.name name for channel, less than 21 sign, lowerCase, no space
     * @param  {string} options.topic slack channel topic
     * @param  {Array} options.invite user emails to invite
     * @param  {string[]} options.purpose issue summary
     * @returns {string} Slack channel id
     */
    async createRoom({ name, topic, invite, purpose }) {
        try {
            const options = {
                is_private: true,
                name: name.toLowerCase(),
            };
            const { channel } = await this.client.conversations.create(options);
            const roomId = channel.id;
            await Promise.all(
                invite.map(async name => {
                    try {
                        await this.invite(roomId, name);
                    } catch (error) {
                        this.logger.warn(
                            // eslint-disable-next-line
                            `User ${name} is not in slack, try to add him. Room for jira issue ${name} will be without him.`,
                        );
                    }
                }),
            );
            await this.setRoomTopic(roomId, topic);
            await this.setPurpose(roomId, purpose);

            return roomId;
        } catch (err) {
            this.logger.error(err);
            throw ['Error while creating room', err].join('\n');
        }
    }

    // ! TODO OVERRIDE
    /**
     * @param {string} name displayName
     * @returns {string} slack id
     */
    getUserIdByDisplayName(name) {
        return name;
    }

    /**
     * Get slack channel id by name
     *
     * @param  {string} name slack channel name
     * @returns {string|undefined} channel id if exists
     */
    async getRoomId(name) {
        const searchingName = name.toLowerCase();
        try {
            // ? Limit of channels is only 1000 now
            const { channels } = await this.client.users.conversations({ limit: 1000, types: 'private_channel' });
            const channel = channels.find(item => item.name === searchingName);

            const roomId = Ramda.path(['id'], channel);
            if (!roomId) {
                throw `No channel for ${searchingName}`;
            }

            return roomId;
        } catch (err) {
            throw [`Error getting channel id by name "${searchingName}" from Slack`, err].join('\n');
        }
    }

    /**
     * Check if user is in matrix room
     *
     * @param {string} roomId matrix room id
     * @param {string} name slack user name like ii_ivanov
     * @returns {Promise<boolean>} return true if user in room
     */
    async isRoomMember(roomId, name) {
        const email = this._getEmail(name);
        const slackId = await this._getUserIdByEmail(email);
        const roomMembers = await this.getRoomMembers({ roomId });

        return roomMembers.includes(slackId);
    }

    /**
     * Invite user to slack channel
     *
     * @param  {string} channel slack channel id
     * @param  {string} name slack user name or email
     */
    async invite(channel, name) {
        const email = this._getEmail(name);
        try {
            const userId = await this._getUserIdByEmail(email);
            const response = await this.client.conversations.invite({ channel, users: userId });

            return response.ok;
        } catch (err) {
            this.logger.error(err);
            throw [`Error while inviting user ${email} to a channel ${channel}`, err].join('\n');
        }
    }

    /**
     * get channel members
     *
     * @param {string} name channel name
     * @param {string} slack channel id
     * @returns {string[]} channel members like [nfakjgba, fabfaif]
     */
    async getRoomMembers({ name, roomId }: { roomId?: string; name: string } | { roomId: string; name?: string }) {
        try {
            const channel = roomId || (await this.getRoomId(name));
            const { members } = await this.client.conversations.members({ channel });

            return members;
        } catch (err) {
            throw [`Error while getting slack members from channel ${name}`, err].join('\n');
        }
    }

    /**
     * Set new name to the channel
     *
     * @param  {string} channel channel id
     * @param  {string} name new topic
     * @returns {boolean} request result
     */
    async setRoomName(channel, name) {
        try {
            const res = await this.client.conversations.rename({ channel, name });

            return res.ok;
        } catch (err) {
            this.logger.error(err);
            throw ['Error while setting channel topic', err].join('\n');
        }
    }

    /**
     * Get Conversation Info by id
     *
     * @param {string} channel conversation Id
     */
    async getRoomInfo(channel) {
        try {
            const roomInfo = await this.client.conversations.info({ channel });

            return roomInfo.channel;
        } catch (err) {
            this.logger.error(err);
            throw [`Error while getting info by channel ${channel}`, err].join('\n');
        }
    }

    /**
     * Transform name to email or just return email
     *
     * @param {string} name name or email
     * @returns {string} email
     */
    _getEmail(name) {
        return name.includes('@') ? name : `${name}@${this.config.messenger.domain}`;
    }

    /**
     * Get room id by name
     *
     * @param {string} name roomname
     * @returns {Promise<string|false>} return roomId or false if not exisits
     */
    async getRoomIdByName(name) {
        try {
            const roomId = await this.getRoomId(name);
            return roomId;
        } catch (error) {
            return false;
        }
    }

    setPower() {
        this.logger.warn('Set power command is not available now');
    }

    /**
     * compose room name for slack chat
     *
     * @param {string} key Jira issue key
     * @returns {string} room name for jira issue in slack
     */
    composeRoomName(key) {
        return `${key.toLowerCase()}`;
    }

    /**
     * Update room name
     */
    async updateRoomName(roomId: string, newRoomName: string) {
        await this.setRoomName(roomId, newRoomName);
        // await this.setPurpose(roomId, roomData.summary);
    }

    /**
     * Update room info data
     *
     * @param  {string} roomId room id
     * @param  {string} topic new room topic
     * @returns {Promise<void>} void
     */
    async updateRoomData(roomId, topic) {
        await this.setRoomTopic(roomId, topic);
    }

    /**
     * Check if user is in room
     *
     * @param {string} channel channel id
     * @returns {boolean} return true if user in this room
     */
    async isInRoom(channel) {
        try {
            await this.getRoomInfo(channel);

            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get matrix room by alias
     */
    getRoomAdmins() {
        return [];
    }

    getAllMessagesFromRoom() {
        return [];
    }

    kickUserByRoom() {
        return {};
    }

    /**
     * Delete matrix room alias
     *
     * @param {string} aliasPart aliasPart
     * @returns {string|undefined} return allias if command is succedded
     */
    deleteRoomAlias(aliasPart) {
        return aliasPart;
    }

    /**
     * Get room data by room id
     *
     * @param {string} roomId matrix room id
     */
    getRoomDataById(roomId) {
        return roomId;
    }

    upload() {
        return undefined;
    }

    uploadContent() {
        return undefined as any;
    }

    createAlias() {
        return undefined;
    }

    getDownloadLink() {
        return undefined;
    }

    setRoomJoinedByUrl() {
        return undefined;
    }

    joinRoom() {
        return undefined;
    }
    getRooms() {
        return undefined;
    }
    setRoomAvatar() {
        return undefined;
    }
    getAllEventsFromRoom() {
        return undefined;
    }
    getRoomLink(idOrAlias: string) {
        return idOrAlias;
    }
}
