/* eslint-disable handle-callback-err */
const simpleGit = require('simple-git/promise');
const fs = require('fs').promises;
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
    { name: 'admin1', displayName: 'Room Admin 1', userId: 'admin1' },
    { name: 'admin2', displayName: 'Room Admin 2', userId: 'admin2' },
];

// const roomAdmins3 = ['Room Admin 1', 'Room Admin 2'];

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

const baseMedia = 'http://base.example';

const getMediaLink = el => `${baseMedia}/${el}`;

module.exports = {
    baseMedia,

    roomAdmins,

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
            getRoomAdmins: stub().resolves([]),
            getAllMessagesFromRoom: stub().resolves(allMessagesFromRoom),
            getAllEventsFromRoom: stub().resolves(rawEvents),
            getDownloadLink: stub().callsFake(el => getMediaLink(el)),
        });

        const allMembers = [...roomAdmins, ...defaultExistedUsers].map(({ userId }) => chatApi.getChatUserId(userId));
        chatApi.getRoomMembers = stub().resolves(allMembers);

        chatApi.getRoomIdForJoinedRoom = stub().throws('No bot in room with id');
        // console.log('TCL: stubInstance', chatApi);
        existedUsers.map(({ displayName, userId }) =>
            chatApi.getUser.withArgs(chatApi.getChatUserId(userId)).resolves(true),
        );
        chatApi.getRoomAdmins.withArgs({ roomId }).resolves(
            roomAdmins.map(({ name }) => ({
                userId: realChatApi.getChatUserId(name),
                name,
            })),
        );
        existedUsers.forEach(item => {
            const user = typeof item === 'string' ? { userId: item, displayName: 'Some Display Name' } : item;
            chatApi.getUser.withArgs(chatApi.getChatUserId(user.userId)).resolves({ displayName: user.displayName });
        });
        roomAdmins.forEach(item => {
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

    startGitServer: tmpDirName => {
        const repoDir = path.resolve(__dirname, tmpDirName);
        // console.log('repoDir', repoDir);
        const repos = new Server(repoDir, {
            autoCreate: true,
        });

        repos.on('push', push => {
            // console.log(`push ${push.repo}${push.commit} (${push.branch})`);
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
            // console.log('fetch', fetch);
            // console.log(`fetch ${fetch.commit}`);
            fetch.accept();
        });

        repos.listen(settings.gitServerPort, () => {
            // console.log(`node-git-server running at http:localhost:${settings.gitServerPort}`);
        });

        return repos;
    },

    setRepo: async (basePath, remote) => {
        const tmpPath = path.resolve(basePath, 'git-init');
        await fs.mkdir(tmpPath);
        await fs.writeFile(path.join(tmpPath, 'readme.txt'));

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
