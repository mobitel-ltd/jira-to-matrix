const { prefix } = require('../fixtures/config.js').redis;
const redis = require('../../src/redis-client.js');
const defaultConfig = require('../../src/config');
const getChatApi = require('../../src/messengers');
const { stub, createStubInstance } = require('sinon');

const defaultRoomId = 'roomId';
const defaultAlias = 'ALIAS';
const defaultExistedUsers = [
    { userId: 'correctUser', displayName: 'Correct User 1' },
    { userId: 'correctUser2', displayName: 'Correct User 2' },
];

const usersWithSamePartName = ['Ivan Andreevich A', 'Ivan Sergeevich B'];

const usersDict = {
    'Иванов Иван Иванович': 'ii_ivanov',
    'Петров Петр Петрович': 'pp_petrov',
    'Сидоров Егор Ильич': 'ei_sidorov',
    'Борисов Борис Борисович': 'bb_borisov',
    jira_bot: 'jira_bot',
    // project lead
    'Fred F. User': 'ff_user',
    jira_test: 'jira_test',
    [usersWithSamePartName[0]]: 'ivan_A',
    [usersWithSamePartName[1]]: 'ivan_B',
};

module.exports = {
    usersWithSamePartName,

    getExistingDisplayName: () => Object.keys(usersDict)[0],

    getUserIdByDisplayName: name => usersDict[name],

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
     * @param {({userId: string, displayName:string}|string)[]} options.existedUsers users which id will be returned
     * @returns {object} instance of messenger class
     */
    getChatApi: (options = {}) => {
        const { config, alias, roomId, existedUsers, joinedRooms = [] } = {
            config: defaultConfig,
            alias: defaultAlias,
            roomId: defaultRoomId,
            existedUsers: defaultExistedUsers,
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
            getCommandRoomName: realChatApi.getCommandRoomName(),
            getUserIdByDisplayName: stub().callsFake(name => realChatApi.getChatUserId(usersDict[name])),
        });

        chatApi.getRoomIdForJoinedRoom = stub().throws('No bot in room with id');
        // console.log('TCL: stubInstance', chatApi);

        existedUsers.forEach(item => {
            const user = typeof item === 'string' ? { userId: item, displayName: 'Some Display Name' } : item;
            chatApi.getUser.withArgs(chatApi.getChatUserId(user.userId)).resolves({ displayName: user.displayName });
        });

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
