const { prefix } = require('../fixtures/config.js').redis;
const redis = require('../../src/redis-client.js');
const defaultConfig = require('../../src/config');
const getChatApi = require('../../src/messengers');
const { stub, createStubInstance } = require('sinon');

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

    /**
     * @param {object} options params
     * @param {object} options.type config params
     * @param {string} options.alias alias to return correct roomId
     * @param {string} options.roomId roomId to return
     * @returns {object} instance of messenger class
     */
    getChatApi: (options = {}) => {
        const { config, alias, roomId, joinedRooms = [] } = {
            config: defaultConfig,
            alias: defaultAlias,
            roomId: defaultRoomId,
            ...options,
        };

        const ChatApi = getChatApi(config.messenger.name);
        const realChatApi = new ChatApi({ config: config.messenger });
        const chatApi = createStubInstance(ChatApi, {
            getRoomId: stub().throws(),
            createRoom: stub().resolves(roomId),
            getUser: stub().resolves(null),
            getChatUserId: stub().callsFake(realChatApi.getChatUserId.bind(realChatApi)),
            getRoomIdByName: stub().resolves(false),
            composeRoomName: stub().callsFake(realChatApi.composeRoomName.bind(realChatApi)),
            getAdmins: realChatApi.getAdmins(),
            getMyId: realChatApi.getMyId(),
            getNotifyData: realChatApi.getNotifyData(),
            isConnected: stub().returns(true),
            isInRoom: stub().resolves(true),
        });

        chatApi.getRoomIdForJoinedRoom = stub().throws('No bot in room with id');
        // console.log('TCL: stubInstance', chatApi);

        chatApi.getUser.withArgs('correctUser').resolves(true);
        chatApi.getChatUserId.withArgs('correctUser').resolves('correctUser');
        chatApi.getUser.withArgs('correctUser2').resolves(true);
        chatApi.getChatUserId.withArgs('correctUser2').resolves('correctUser2');
        if (Array.isArray(alias)) {
            alias.forEach(item => {
                chatApi.getRoomId.withArgs(item).resolves(roomId);
                chatApi.getRoomIdByName.withArgs(item).resolves(roomId);
            });
        } else {
            chatApi.getRoomId.withArgs(alias).resolves(roomId);
            chatApi.getRoomIdByName.withArgs(alias).resolves(roomId);
        }

        [defaultRoomId, ...joinedRooms].forEach(id => {
            chatApi.getRoomIdForJoinedRoom.withArgs(id).resolves(roomId);
        });

        return chatApi;
    },
};
