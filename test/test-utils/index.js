const { prefix } = require('../fixtures/config.js').redis;
const redis = require('../../src/redis-client.js');
const config = require('../../src/config');
const getChatApi = require('../../src/messengers');
const { stub } = require('sinon');

const defaultRoomId = 'roomId';
const defaultAlias = 'ALIAS';

module.exports = {
    cleanRedis: async () => {
        const keys = await redis.keysAsync('*');

        if (keys.length > 0) {
            const parsedKeys = keys.map(key => key.replace(`${prefix}`, ''));
            await redis.delAsync(parsedKeys);
        }
    },

    getRoomId: () => defaultRoomId,

    getAlias: () => defaultAlias,

    getChatApi: (options = {}) => {
        const { type, alias, roomId } = {
            type: config.messenger.name,
            alias: defaultAlias,
            roomId: defaultRoomId,
            ...options,
        };
        const ChatApi = getChatApi(type);
        const realChatApi = new ChatApi({ config: config.messenger });

        const chatApi = {
            sendHtmlMessage: stub(),
            getRoomId: stub().throws(),
            createRoom: stub().resolves('correct room'),
            getRoomMembers: stub(),
            invite: stub(),
            getChatUserId: stub().callsFake(realChatApi.getChatUserId.bind(realChatApi)),
            updateRoomName: stub(),
            updateRoomData: stub(),
            setRoomName: stub(),
            setRoomTopic: stub(),
            getRoomIdByName: stub().resolves(false),
            composeRoomName: stub().callsFake(realChatApi.composeRoomName.bind(realChatApi)),
            setRoomAvatar: stub(),
        };
        if (Array.isArray(alias)) {
            alias.forEach(item => {
                chatApi.getRoomId.withArgs(item).resolves(roomId);
                chatApi.getRoomIdByName.withArgs(item).resolves(roomId);
            });
        } else {
            chatApi.getRoomId.withArgs(alias).resolves(roomId);
            chatApi.getRoomIdByName.withArgs(alias).resolves(roomId);
        }

        return chatApi;
    },
};
