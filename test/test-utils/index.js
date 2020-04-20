/* eslint-disable no-empty-function */
/* eslint-disable handle-callback-err */
const faker = require('faker');
const R = require('ramda');
const simpleGit = require('simple-git/promise');
const fs = require('fs').promises;
const fsExtra = require('fs-extra');
const path = require('path');
const Server = require('node-git-server');
const { prefix } = require('../fixtures/config.js').redis;
const redis = require('../../src/redis-client.js');
const defaultConfig = require('../../src/config');
const getChatApi = require('../../src/messengers');
const { stub, createStubInstance } = require('sinon');
const allMessagesFromRoom = require('../fixtures/archiveRoom/allMessagesFromRoom.json');
const settings = require('../fixtures/settings');
const rawEvents = require('../fixtures/archiveRoom/raw-events');

const defaultRoomId = 'roomId';
const defaultAlias = 'ALIAS';

const roomAdmins = [
    { name: 'admin1', displayName: 'Room Admin 1' },
    { name: 'admin2', displayName: 'Room Admin 2' },
];

// const roomAdmins3 = ['Room Admin 1', 'Room Admin 2'];

const defaultExistedUsers = [
    { userId: 'correctUser', displayName: 'Correct User 1', name: 'correctUser' },
    { userId: 'correctUser2', displayName: 'Correct User 2', name: 'correctUser2' },
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

const baseMedia = 'http://base.example';

const getMediaLink = el => `${baseMedia}/${el}`;

module.exports = {
    baseMedia,

    roomAdmins,

    allRoomMembers: [...roomAdmins, ...defaultExistedUsers],

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
     * @param {object} [options.type] config params
     * @param {string|string[]} [options.alias] alias to return correct roomId
     * @param {string} [options.roomId] roomId to return
     * @param {({userId: string, displayName:string}|string)[]} [options.existedUsers] users which id will be returned
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
        const defRoomId = Array.isArray(roomId) ? roomId[0] : roomId;
        const allRoomIds = Array.isArray(roomId) ? roomId : [roomId];
        const allAliases = Array.isArray(alias) ? alias : [alias];
        const rooms = R.zipObj(allAliases, allRoomIds);

        const ChatApi = getChatApi(config.messenger.name);
        const realChatApi = new ChatApi({ config: config.messenger });
        const chatApi = createStubInstance(ChatApi, {
            getRoomId: stub().throws(),
            createRoom: stub().resolves(defRoomId),
            getUser: stub().resolves(null),
            getChatUserId: stub().callsFake(realChatApi.getChatUserId.bind(realChatApi)),
            getRoomIdByName: stub().resolves(false),
            composeRoomName: stub().callsFake(realChatApi.composeRoomName.bind(realChatApi)),
            isMaster: realChatApi.isMaster(),
            getAdmins: realChatApi.getAdmins(),
            getMyId: realChatApi.getMyId(),
            getBotId: realChatApi.getBotId(),
            getNotifyData: realChatApi.getNotifyData(),
            isConnected: stub().returns(true),
            isInRoom: stub().resolves(true),
            getCommandRoomName: realChatApi.getCommandRoomName(),
            getUserIdByDisplayName: stub().callsFake(name => realChatApi.getChatUserId(usersDict[name])),
            getRoomAdmins: stub().resolves([]),
            getAllMessagesFromRoom: stub().resolves(allMessagesFromRoom),
            getAllEventsFromRoom: stub().resolves(rawEvents),
            getDownloadLink: stub().callsFake(el => getMediaLink(R.pipe(R.split('/'), R.last)(el))),
            kickUserByRoom: stub().callsFake(userId => userId),
            getRoomDataById: stub(),
        });
        chatApi.getRoomAndClient = stub();

        const allMembers = [...roomAdmins, ...defaultExistedUsers].map(({ userId, name }) =>
            chatApi.getChatUserId(userId || name),
        );
        chatApi.getRoomMembers = stub().resolves(allMembers);

        const allMembersWithPower = [
            ...allMembers.map(userId => ({ userId, powerLevel: 50 })),
            { userId: chatApi.getMyId(), powerLevel: 100 },
        ];

        allRoomIds.forEach(id => {
            const roomData = {
                alias: allAliases.find(key => rooms[key] === id),
                id,
                members: allMembersWithPower,
            };
            chatApi.getRoomDataById.withArgs(id).resolves(roomData);
            chatApi.getRoomAndClient.resolves({
                roomData,
                client: chatApi,
            });
        });

        chatApi.getRoomIdForJoinedRoom = stub().throws('No bot in room with id');
        existedUsers.map(({ displayName, userId }) =>
            chatApi.getUser.withArgs(chatApi.getChatUserId(userId)).resolves(true),
        );
        allRoomIds.forEach(id => {
            chatApi.getRoomAdmins.withArgs({ roomId: id }).resolves(
                roomAdmins.map(({ name }) => ({
                    userId: realChatApi.getChatUserId(name),
                    name,
                })),
            );
        });
        existedUsers.forEach(item => {
            const user = typeof item === 'string' ? { userId: item, displayName: 'Some Display Name' } : item;
            chatApi.getUser.withArgs(chatApi.getChatUserId(user.userId)).resolves({ displayName: user.displayName });
        });
        roomAdmins.forEach(item => {
            const user = typeof item === 'string' ? { userId: item, displayName: 'Some Display Name' } : item;
            chatApi.getUser.withArgs(chatApi.getChatUserId(user.userId)).resolves({ displayName: user.displayName });
        });

        allAliases.forEach(item => {
            chatApi.getRoomId.withArgs(item).resolves(rooms[item]);
            chatApi.getRoomIdByName.withArgs(item).resolves(rooms[item]);
        });

        [defaultRoomId, ...joinedRooms].forEach(id => {
            chatApi.getRoomIdForJoinedRoom.withArgs(id).resolves(roomId);
        });

        return chatApi;
    },

    startGitServer: tmpDirName => {
        const repoDir = path.resolve(__dirname, tmpDirName);
        const repos = new Server(repoDir, {
            autoCreate: true,
        });

        repos.on('push', push => {
            repos.list((err, results) => {
                push.log(' ');
                push.log('Hey!');
                push.log('Checkout these other repos:');
                for (const repo of results) {
                    push.log(`- ${repo}`);
                }
                push.log(' ');
            });

            push.accept();
        });

        repos.on('fetch', fetch => {
            fetch.accept();
        });

        repos.listen(settings.gitServerPort, () => {});

        return repos;
    },

    setRepo: async (basePath, remote, { pathToExistFixtures, roomName }) => {
        const tmpPath = path.resolve(basePath, `git-init-${faker.random.alphaNumeric(10)}`);
        await fs.mkdir(tmpPath);
        await fs.writeFile(path.join(tmpPath, 'readme.txt'));
        if (pathToExistFixtures) {
            const existDataPathName = path.resolve(tmpPath, roomName);
            await fsExtra.copy(pathToExistFixtures, existDataPathName);
        }

        const git = simpleGit(tmpPath);
        await git.init();
        await git.add('./*');
        await git.addConfig('user.name', 'Some One');
        await git.addConfig('user.email', 'some@one.com');
        await git.commit('first commit!');
        await git.addRemote('origin', remote);
        await git.push('origin', 'master');
    },
};
