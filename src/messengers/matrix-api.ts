/* eslint-disable no-undefined */
/* eslint no-empty-function: ["error", { "allow": ["arrowFunctions"] }] */
import matrixSdk from 'matrix-js-sdk';
import { errorTracing } from '../lib/utils';
import * as R from 'ramda';
import { BaseChatApi } from './base-api';
import { MessengerApi, RoomData, ChatConfig, CommandNames } from '../types';
import { Commands } from '../bot/commands';
import { LoggerInstance } from 'winston';
import { NO_ROOM_PATTERN, END_NO_ROOM_PATTERN } from '../lib/consts';
import axios from 'axios';

const getEvent = content => ({
    getType: () => 'm.room.power_levels',
    getContent: () => content,
});

export enum Msgtype {
    text = 'm.text',
    image = 'm.image',
    audio = 'm.audio',
    emote = 'm.emote',
    notice = 'm.notice',
    file = 'm.file',
    location = 'm.location',
    video = 'm.video',
}

interface BaseContent {
    body: string;
}

interface FileContent extends BaseContent {
    filename: string;
    info: {
        mimetype: string;
        size: number;
    };
    msgtype: Msgtype.file;
    url: string;
}

interface TextContent extends BaseContent {
    msgtype: Msgtype.text;
}

interface ImageContent extends BaseContent {
    info: {
        h: number;
        mimetype: string;
        size: number;
        w: number;
    };
    msgtype: Msgtype.image;
    url: string;
}

type Content = ImageContent | TextContent | FileContent;
const removeStatus = 'shouldRemove';

interface FailParse {
    isSuccess: false;
    body?: typeof removeStatus;
}
interface SuccessParse {
    isSuccess: true;
    body: { commandName: CommandNames; url?: string; bodyText?: string };
}

export class MatrixApi extends BaseChatApi implements MessengerApi {
    userId: string;
    baseUrl: string;
    // matrix client
    client: any;
    connection = false;

    constructor(commands: Commands, config: ChatConfig, logger: LoggerInstance, sdk = matrixSdk) {
        super(commands, config, logger, sdk);
        this.userId = `@${this.config.user}:${this.config.messenger.domain}`;
        this.baseUrl = `https://${this.config.messenger.domain}`;
    }

    getRoomLink(idOrAlias: string) {
        const endpoint = idOrAlias.startsWith('!') ? idOrAlias : this._getMatrixRoomAlias(idOrAlias);

        return [this.baseUrl, '#', 'room', endpoint].join('/');
    }

    get postfix() {
        return `:${this.config.messenger.domain}`.length;
    }

    get USER_ALREADY_IN_ROOM() {
        return 'is already in the room';
    }

    get BOT_OUT_OF_ROOM_EXEPTION() {
        return `User ${this.getMyId()} not in room`;
    }

    /**
     * @returns {string} user id
     */
    getMyId(): string {
        return this.config.user;
    }

    /**
     * @returns {string} matrix user id
     */
    getBotId(): string {
        return this.getMyId();
    }

    get EVENT_EXCEPTION() {
        return 'Could not find event';
    }

    get MESSAGE_TO_LARGE() {
        return 'event too large';
    }

    /**
     * Transform ldap user name to matrix user id
     */
    getChatUserId(shortName: string): string {
        return shortName && `@${shortName.toLowerCase()}:${this.config.messenger.domain}`;
    }

    /**
     * Get name from matrix id
     */
    _getNameFromMatrixId(id: string): string | undefined {
        if (id) {
            const [name] = id.split(':').slice(0, 1);

            return name.slice(1);
        }
    }

    createCommand(commandPart?: string): string;
    createCommand(): undefined;
    createCommand(commandPart?: string): string | undefined {
        return commandPart && `!${commandPart}`;
    }

    parseTextBody(body: string): SuccessParse | FailParse {
        try {
            const trimedBody = body.trim();

            const commandNameFromUser = R.pipe(
                R.split(' '),
                R.head,
                R.match(/^!\w+$/g),
                R.head,
                R.ifElse(R.isNil, R.always(''), R.drop(1)),
            )(body);

            if (this.config.features.postEachComments) {
                if (!Object.values(CommandNames).some(el => el === commandNameFromUser)) {
                    return {
                        isSuccess: true,
                        body: { commandName: CommandNames.Comment, bodyText: trimedBody },
                    };
                }
            }

            if (!commandNameFromUser) {
                return {
                    isSuccess: false,
                };
            }
            const commandName = commandNameFromUser;

            if (this.createCommand(commandName) === trimedBody) {
                return {
                    isSuccess: true,
                    body: { commandName },
                };
            }

            const bodyText = trimedBody.replace(this.createCommand(commandNameFromUser), '').trim();

            return {
                isSuccess: true,
                body: { commandName, bodyText },
            };
        } catch (err) {
            this.logger.error(`Error in parsing comment from matrix: ${err}`);
            return {
                isSuccess: false,
            };
        }
    }

    parseFileBody(content: FileContent): SuccessParse | FailParse {
        if (!this.config.features.postEachComments) {
            return {
                isSuccess: false,
            };
        }
        if (content.info.size >= this.config.maxFileSize) {
            return {
                isSuccess: false,
                body: removeStatus,
            };
        }

        return {
            isSuccess: true,
            body: {
                bodyText: content.body,
                commandName: CommandNames.Upload,
                url: this.getDownloadLink(content.url),
            },
        };
    }

    parseImageBody(content: ImageContent): SuccessParse | FailParse {
        if (!this.config.features.postEachComments) {
            return {
                isSuccess: false,
            };
        }
        if (content.info.size >= this.config.maxFileSize) {
            return {
                isSuccess: false,
                body: removeStatus,
            };
        }

        return {
            isSuccess: true,
            body: {
                bodyText: content.body,
                commandName: CommandNames.Upload,
                url: this.getDownloadLink(content.url),
            },
        };
    }

    parseEventBody(content: Content): SuccessParse | FailParse {
        switch (content.msgtype) {
            case Msgtype.text:
                return this.parseTextBody(content.body);
            case Msgtype.image:
                return this.parseImageBody(content);
            case Msgtype.file:
                return this.parseFileBody(content);
            default:
                return {
                    isSuccess: false,
                };
        }
    }

    /**
     * Matrix events handler
     */
    async timelineHandler(event: any, room: any, toStartOfTimeline: boolean) {
        try {
            if (event.getType() !== 'm.room.message' || toStartOfTimeline) {
                return;
            }

            const sender = this._getNameFromMatrixId(event.getSender())!;

            if (sender === this.getMyId()) {
                return;
            }
            const senderDisplayName = event?.sender?.name;

            const content: Content = event.getContent();

            const parseRes = this.parseEventBody(content);
            const roomData = this.getRoomData(room);
            const roomName = roomData.alias;

            if (!parseRes.isSuccess) {
                if (parseRes.body === removeStatus) {
                    this.logger.warn('Media size is bigger than limited, start removing');
                    await this.client.redactEvent(roomData.id, event.getId());
                    const message = 'Media upload is too big, max size is 10 mb';
                    // await this.commands.run(CommandNames.Comment, {
                    //     roomData,
                    //     chatApi: this,
                    //     sender,
                    //     roomName,
                    //     roomId: room.roomId,
                    //     bodyText: message,
                    // });
                    await this.sendHtmlMessage(room.roomId, message, message);
                    return;
                }
                return;
            }
            const { commandName, ...bodyData } = parseRes.body;

            if (commandName === CommandNames.Comment && roomData.alias === this.getNotifyData()?.name) {
                return;
            }

            // TODO add class to commandsHandler
            await this.commands.run(commandName, {
                roomData,
                chatApi: this,
                sender,
                roomName,
                roomId: room.roomId,
                senderDisplayName,
                ...bodyData,
            });
        } catch (err) {
            const errMsg = errorTracing(
                `Error while handling event from Matrix room "${room.name}" ${room.roomId}`,
                err,
            );
            this.logger.error(errMsg);
        }
    }

    /**
     * Convert string with alias to matrix form
     */
    _getMatrixRoomAlias(alias: string): string {
        const upperAlias = alias.toUpperCase();

        return `#${upperAlias}:${this.config.messenger.domain}`;
    }

    /**
     * Check if err should be ignored
     *
     * @param  {object} err catching error body
     * @returns {boolean} true/false
     */
    _isEventExeptionError(err: Error): boolean {
        return (
            typeof err.message === 'string' &&
            (err.message.includes(this.EVENT_EXCEPTION) ||
                err.message.includes(this.BOT_OUT_OF_ROOM_EXEPTION) ||
                err.message.includes(this.MESSAGE_TO_LARGE) ||
                err.message.includes(this.USER_ALREADY_IN_ROOM))
        );
    }

    async _createClient(): Promise<void> {
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

    _executor(resolve: Function): void {
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

    async _startClient(): Promise<any> {
        try {
            await this._createClient();
            this.client.startClient();

            return new Promise(this._executor.bind(this));
        } catch (err) {
            throw ['Error in Matrix connection', err].join('\n');
        }
    }

    async _inviteBot(event: any) {
        if (event.event.membership !== 'invite') {
            return;
        }

        let sender = event.getSender();
        sender = sender.slice(1, -this.postfix);

        if (
            !this.config.messenger.admins.includes(sender) &&
            sender !== this.config.user &&
            event.getStateKey() === this.getMyId()
        ) {
            await this.client.leave(event.getRoomId());
            return;
        }

        if (event.getStateKey() === this.getMyId()) {
            await this.client.joinRoom(event.getRoomId());
        }
    }

    async leaveRoom(roomId: string): Promise<string | false> {
        try {
            await this.client.leave(roomId);
            this.logger.info(`Left room with id ${roomId}`);

            return roomId;
        } catch (err) {
            this.logger.error([`leave room ${roomId}`, err].join('\n'));

            return false;
        }
    }

    _removeListener(eventName: string, listener: Function, matrixClient: any) {
        const listCount = matrixClient.listenerCount(eventName);
        if (listCount > 1) {
            matrixClient.removeListener(eventName, listener);
            this.logger.warn(`Count listener for ${eventName} ${listCount}. To remove unnecessary listener`);
        }
    }

    /**
     * Handler to add timeline handler to watch events in a room
     */
    _handler(): any {
        if (!this.client) {
            this.logger.error('matrixclient is undefined');
            return;
        }

        this.client.on('Room.timeline', this.timelineHandler.bind(this));

        this.client.on('sync', (state, prevState) => {
            this._removeListener('Room.timeline', this.timelineHandler, this.client);
            this._removeListener('event', this._inviteBot.bind(this), this.client);

            if (state !== 'SYNCING' || prevState !== 'SYNCING') {
                this.logger.warn(`state is ${state}, prevState is ${prevState} for bot with id ${this.config.user}`);
            }
        });

        this.client.on('RoomMember.membership', async (event, member) => {
            if (member.membership === 'invite' && member.userId === this.getMyId()) {
                try {
                    await this.client.joinRoom(member.roomId);
                    this.logger.info(`${this.getMyId()} joined to room with id = ${member.roomId}`);
                } catch (error) {
                    this.logger.error(`Error joining to room with id = ${member.roomId}`);
                }
            }
        });

        this.client.on('event', this._inviteBot.bind(this));

        return this.client;
    }

    getClient(): any {
        return this.client;
    }

    isConnected(): boolean {
        if (this.client) {
            return Boolean(this.client.clientRunning && this.connection);
        }

        return false;
    }

    async connect(): Promise<void> {
        try {
            await this._startClient();

            return this._handler();
        } catch (err) {
            throw ['Error in Matrix connection', err].join('\n');
        }
    }

    disconnect(): void {
        if (this.isConnected()) {
            this.client.stopClient();
            this.logger.info('Disconnected from Matrix');
        }
    }

    async setPower(roomId: string, userId: string, level = 50): Promise<boolean> {
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

    async getUserIdByDisplayName(searchParam: string): Promise<string | undefined> {
        try {
            const method = 'POST';
            const path = '/user_directory/search';
            const body = {
                search_term: searchParam,
                limit: 10000,
            };

            const result = await this.client._http.authedRequest(undefined, method, path, {}, body);
            const domainUsers: string[] | undefined = result?.results
                .map(el => el.user_id)
                .filter((el: string) => el.includes(this.config.messenger.domain));
            const userId: string | undefined = domainUsers && domainUsers[0];

            if (!userId) {
                this.logger.warn(`Not found user by search params ${searchParam}`);
            }

            return userId;
        } catch (error) {
            this.logger.error(error);
            throw error;
        }
    }

    getRoomData(room: any): RoomData {
        const lastCreatedAlias = R.head(room.getAliases()) || room.getCanonicalAlias();
        const alias = this._getNameFromMatrixId(lastCreatedAlias) || null;
        const joinedMembers = room.getJoinedMembers();
        const topicEvent = room.currentState.getStateEvents('m.room.topic', '');
        const topic: string | undefined = topicEvent && R.path(['topic'], topicEvent.getContent());

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

    async getRoomDataById(roomId: string): Promise<RoomData | undefined> {
        const room = await this.client.getRoom(roomId);
        if (room) {
            return this.getRoomData(room);
        }
    }

    getRooms(): Array<any> {
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
     */
    async createRoom({
        invite,
        avatarUrl,
        ...options
    }: {
        room_alias_name: string;
        invite: string[];
        name: string;
        topic?: string;
        purpose?: string;
        avatarUrl?: string;
    }) {
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
     */
    async getRoomId(alias: string): Promise<string> {
        try {
            const { room_id: roomId } = await this.client.getRoomIdForAlias(this._getMatrixRoomAlias(alias));
            return roomId;
        } catch (err) {
            throw [`${NO_ROOM_PATTERN}${alias}${END_NO_ROOM_PATTERN}`, err].join('\n');
        }
    }

    /**
     * Get matrix room by alias
     */
    async getRoomMembers({
        name,
        roomId,
    }: { name: string; roomId?: string } | { name?: string; roomId: string }): Promise<string[]> {
        try {
            const id = roomId || (await this.getRoomId(name as string));
            const room = await this.client.getRoom(id);
            const joinedMembers = room.getJoinedMembers();

            return joinedMembers.map(({ userId }) => userId);
        } catch (err) {
            throw [`Error while getting matrix members from room ${name || roomId}`, err].join('\n');
        }
    }

    /**
     * Get matrix room by alias
     */
    async getRoomAdmins({
        name,
        roomId,
    }: { name?: string; roomId: string } | { name: string; roomId?: string }): Promise<
        { name: string; userId: string }[]
    > {
        try {
            const id = roomId || (await this.getRoomId(name as string));
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
     */
    async isRoomMember(roomId: string, user: string): Promise<boolean> {
        const roomMembers = await this.getRoomMembers({ roomId });
        return roomMembers.includes(user);
    }

    /**
     * Invite user to matrix room
     */
    async invite(roomId: string, userId: string): Promise<boolean> {
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
     */
    async sendTextMessage(roomId: string, body: string): Promise<void> {
        try {
            await this.client.sendTextMessage(roomId, body);
        } catch (err) {
            if (this._isEventExeptionError(err)) {
                this.logger.warn(err.message);

                return;
            }

            throw ['Error in sendHtmlMessage', err].join('\n');
        }
    }

    /**
     * Send message to matrix room
     */
    async sendHtmlMessage(roomId: string, body: string, htmlBody: string): Promise<void> {
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
     */
    async createAlias(name: string, roomId: string): Promise<string | false> {
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
     */
    async setRoomName(roomId: string, name: string): Promise<boolean> {
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

    async setRoomTopic(roomId: string, topic: string): Promise<void> {
        try {
            await this.client.setRoomTopic(roomId, topic);
            this.logger.debug(`New room topic is added for room with id ${roomId}`);
        } catch (err) {
            if (this._isEventExeptionError(err)) {
                this.logger.warn(err.message);
            }

            throw [`Error while setting room's topic`, err].join('\n');
        }
    }

    /**
     * Chack if it's room name
     */
    _isRoomAlias(room: string): boolean {
        return room.includes(this.config.messenger.domain) && room[0] === '#';
    }

    async getRoomIdByName(text: string, notUpper?: boolean): Promise<string | false> {
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

    composeRoomName(key: string, summary: string): string {
        return summary ? `${key} ${summary}` : key;
    }

    async updateRoomName(roomId: string, newRoomName: string): Promise<void> {
        await this.setRoomName(roomId, newRoomName);
    }

    async updateRoomData(roomId: string, topic: string, key: string): Promise<void> {
        await this.createAlias(key, roomId);
        await this.setRoomTopic(roomId, topic);
    }

    async isInRoom(roomId: string): Promise<boolean> {
        const room = await this.client.getRoom(roomId);

        return Boolean(room);
    }

    async setRoomAvatar(roomId: string, url: string): Promise<true | undefined> {
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

    async getAllMessagesFromRoom(
        roomId: string,
    ): Promise<{ author: string; date: string; body: string; eventId: string }[] | undefined> {
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

    async uploadContent(data: Buffer, imageType: string): Promise<string> {
        const uploadResponse = await this.client.uploadContent(data, {
            rawResponse: false,
            type: imageType,
        });
        const matrixUrl = uploadResponse.content_uri;

        return matrixUrl;
    }

    async upload(roomId: string, url: string): Promise<string | undefined> {
        try {
            const mimeTypes = [
                'image/apng',
                'image/bmp',
                'image/gif',
                'image/x-icon',
                'image/jpeg',
                'image/png',
                'image/svg+xml',
                'image/tiff',
                'image/webp',
            ];

            const response = await axios.get(url, { responseType: 'arraybuffer' });
            const imageType = response.headers['content-type'];
            if (mimeTypes.includes(imageType)) {
                const uploadResponse = await this.client.uploadContent(response.data, {
                    rawResponse: false,
                    type: imageType,
                });
                const matrixUrl = uploadResponse.content_uri;
                await this.client.sendImageMessage(roomId, matrixUrl, {}, '');
                return matrixUrl;
            }
        } catch (error) {
            this.logger.error(error);
            throw error;
        }
    }

    async getAllEventsFromRoom(roomId: string, limit = 10000): Promise<any[] | undefined> {
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

    getDownloadLink(mxcUrl: string): string {
        return this.client.mxcUrlToHttp(mxcUrl);
    }

    async kickUserByRoom({ roomId, userId }: { roomId: string; userId: string }): Promise<string | undefined> {
        try {
            const method = 'PUT';
            const path = `/rooms/${encodeURIComponent(roomId)}/state/m.room.member/${encodeURIComponent(userId)}`;
            const qweryParams = {};
            const body = { membership: 'leave', reason: 'kick by bot' };

            await this.client._http.authedRequest(undefined, method, path, qweryParams, body);
            this.logger.info(`Member ${userId} kicked from ${roomId}`);

            return userId;
        } catch (error) {
            const msg = errorTracing(`Error in request for kick ${userId} from ${roomId}.`, JSON.stringify(error));
            this.logger.error(msg);
        }
    }

    async setRoomJoinedByUrl(roomId: string): Promise<true | undefined> {
        try {
            const method = 'PUT';
            const path = `/rooms/${encodeURIComponent(roomId)}/state/m.room.join_rules`;
            // eslint-disable-next-line @typescript-eslint/camelcase
            const body = { join_rule: 'public' };

            await this.client._http.authedRequest(undefined, method, path, {}, body);

            return true;
        } catch (error) {
            this.logger.error(`Error in setting public acceess for roomId ${roomId}`);
            this.logger.error(error);
        }
    }

    async getUser(userId: string): Promise<{ displayName: string; avatarUrl: string } | undefined> {
        try {
            const user = await this.client.getProfileInfo(userId);

            return {
                displayName: user.displayname as string,
                avatarUrl: user.avatar_url as string,
            };
        } catch (err) {
            this.logger.error(`User profile ${userId} is not found. \nError: ${JSON.stringify(err)}`);
        }
    }

    async joinRoom({
        roomId,
        aliasPart,
    }: { roomId?: string; aliasPart: string } | { roomId: string; aliasPart?: string }) {
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

    async deleteRoomAlias(aliasPart: string): Promise<string | void> {
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
            const msg = errorTracing(`deleteRoomAlias "${alias}"`, JSON.stringify(err));
            this.logger.error(msg);
        }
    }
}
