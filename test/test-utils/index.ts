/* eslint-disable no-empty-function */
/* eslint-disable handle-callback-err */
import * as faker from 'faker';
import * as R from 'ramda';
// import  from 'simple-git/promise';
import * as fs from 'fs';
import * as fsExtra from 'fs-extra';
import * as path from 'path';
import Server = require('node-git-server');
import { redis } from '../../src/redis-client';
import * as baseConfig from '../../src/config';
import * as getApi from '../../src/messengers';
import Sinon, { stub, createStubInstance, SinonStubbedInstance, StubbableType, SinonStubbedMember } from 'sinon';
import allMessagesFromRoom from '../fixtures/archiveRoom/allMessagesFromRoom.json';
import { settings } from '../fixtures/settings';
import { rawEvents } from '../fixtures/archiveRoom/raw-events';
import { Config, MessengerApi, RoomData } from '../../src/types';
import { ChatFasade } from '../../src/messengers/chat-fasade';
import gitP, { SimpleGit } from 'simple-git/promise';
import { getTaskTracker } from '../../src/task-trackers';
import { Commands } from '../../src/bot/commands';
import { Actions } from '../../src/bot/actions';
import { Jira } from '../../src/task-trackers/jira';

export const taskTracker = getTaskTracker(baseConfig.config) as Jira;

export type StubbedClass<T> = SinonStubbedInstance<T> & T;

export function createSinonStubInstance<T>(
    constructor: StubbableType<T>,
    overrides?: { [K in keyof T]?: SinonStubbedMember<T[K]> },
): StubbedClass<T> {
    const stub = createStubInstance<T>(constructor, overrides);
    return (stub as unknown) as StubbedClass<T>;
}

const { prefix } = baseConfig.config.redis;

export const defaultRoomId = 'roomId';
const defaultAlias = 'ALIAS';

export const roomAdmins: { name: string; displayName: string; userId?: string }[] = [
    { name: 'admin1', displayName: 'Room Admin 1' },
    { name: 'admin2', displayName: 'Room Admin 2' },
];

// const roomAdmins3 = ['Room Admin 1', 'Room Admin 2'];

const defaultExistedUsers = [
    { userId: 'correctUser', displayName: 'Correct User 1', name: 'correctUser' },
    { userId: 'correctUser2', displayName: 'Correct User 2', name: 'correctUser2' },
];

export const usersWithSamePartName = ['Ivan Andreevich A', 'Ivan Sergeevich B'];

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
export const matrixUrl = 'mxc://matrix.example.com/oNcSMEylPshkRHwqkckxzgzb';
export const baseMedia = 'http://base.example';

const getMediaLink = el => `${baseMedia}/${el}`;

export const allRoomMembers = [...roomAdmins, ...defaultExistedUsers];

export const getExistingDisplayName = () => Object.keys(usersDict)[0];

export const getUserIdByDisplayName = name => usersDict[name];

export const cleanRedis = async () => {
    const keys = await redis.keysAsync('*');

    if (keys.length > 0) {
        const parsedKeys = keys.map(key => key.replace(`${prefix}`, ''));
        await redis.delAsync(parsedKeys);
    }
};

export const getRoomId = () => defaultRoomId;

export const stubAction = createSinonStubInstance(Actions);

export const getAlias = () => defaultAlias;

export const getChatClass = (options?: {
    config?: Config;
    type?: object;
    alias?: string | string[];
    roomId?: string | string[];
    existedUsers?: ({ userId: string; displayName: string } | string)[];
    joinedRooms?: string[];
}): {
    chatApi: ChatFasade;
    chatApiSingle;
    getRoomData: (data?: { alias?: string; roomId?: string; name?: string }) => RoomData;
} => {
    const { config, alias, roomId, existedUsers, joinedRooms = [] } = {
        config: baseConfig.config,
        alias: defaultAlias,
        roomId: defaultRoomId,
        existedUsers: defaultExistedUsers,
        ...options,
    };
    const defRoomId = Array.isArray(roomId) ? roomId[0] : roomId;
    const allRoomIds = Array.isArray(roomId) ? roomId : [roomId];
    const allAliases = Array.isArray(alias) ? alias : [alias];
    const rooms = R.zipObj(allAliases, allRoomIds);

    const ChatApi = getApi.getChatClass(config.messenger.name);
    const commands = new Commands(config, taskTracker);
    const [realChatApi] = config.messenger.bots.map(item => {
        return new ChatApi(commands, { ...config, ...item }, console as any, {} as any);
    });

    const chatApiSingle = createStubInstance(ChatApi as any, {
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
        getRoomMembers: stub(),
        uploadContent: stub(),
        upload: stub().resolves(matrixUrl),
        getRoomLink: stub().callsFake(el => realChatApi.getRoomLink(el)),
    });

    const chatApi = new ChatFasade([(chatApiSingle as any) as MessengerApi]);
    chatApi.getRoomIdForJoinedRoom = stub();
    // chatApi.getRoomAndClient = stub();

    const allMembers = allRoomMembers.map(member => chatApi.getChatUserId(member.userId ? member.userId : member.name));
    chatApiSingle.getRoomMembers.resolves(allMembers);

    const allMembersWithPower: RoomData['members'] = [
        ...allMembers.map(userId => ({ userId, powerLevel: 50 })),
        { userId: realChatApi.getMyId(), powerLevel: 100 },
    ];

    allRoomIds.forEach(id => {
        const roomData: RoomData = {
            name: 'some name',
            alias: allAliases.find(key => rooms[key] === id) || null,
            id,
            members: allMembersWithPower,
        };
        chatApiSingle.getRoomDataById.withArgs(id).resolves(roomData);
        // (chatApi.getRoomAndClient as Sinon.SinonStub).resolves({
        //     roomData,
        //     client: chatApi,
        // });
    });

    chatApi.getRoomIdForJoinedRoom = stub().throws('No bot in room with id');
    existedUsers.forEach(user => {
        const userId = typeof user === 'string' ? user : user.userId;
        chatApiSingle.getUser.withArgs(chatApi.getChatUserId(userId)).resolves(true);
    });
    allRoomIds.forEach(id => {
        chatApiSingle.getRoomAdmins.withArgs({ roomId: id }).resolves(
            roomAdmins.map(({ name }) => ({
                userId: realChatApi.getChatUserId(name),
                name,
            })),
        );
    });
    existedUsers.forEach(item => {
        const user = typeof item === 'string' ? { userId: item, displayName: 'Some Display Name' } : item;
        chatApiSingle.getUser.withArgs(chatApi.getChatUserId(user.userId)).resolves({ displayName: user.displayName });
    });
    roomAdmins.forEach(item => {
        const user = typeof item === 'string' ? { userId: item, displayName: 'Some Display Name' } : item;
        chatApiSingle.getUser.withArgs(chatApi.getChatUserId(user.userId)).resolves({ displayName: user.displayName });
    });

    allAliases.forEach(item => {
        chatApiSingle.getRoomId.withArgs(item).resolves(rooms[item]);
        chatApiSingle.getRoomIdByName.withArgs(item).resolves(rooms[item]);
    });

    [defaultRoomId, ...joinedRooms].forEach(id => {
        (chatApi.getRoomIdForJoinedRoom as Sinon.SinonStub).withArgs(id).resolves(roomId);
    });
    const getRoomData = (data?: { alias: string; roomId: string; name: string }): RoomData => ({
        alias: data?.alias || defaultAlias,
        id: data?.roomId || defRoomId,
        name: data?.name || 'some name',
        members: allMembersWithPower,
    });

    return { chatApiSingle, chatApi, getRoomData };
};

export const startGitServer = (tmpDirName: string) => {
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

    repos.listen(settings.gitServerPort, () => {
        return;
    });

    return repos;
};

export const setRepo = async (
    basePath: string,
    remote,
    options: { pathToExistFixtures?: string; roomName: string },
) => {
    const tmpPath = path.resolve(basePath, `git-init-${faker.random.alphaNumeric(10)}`);
    await fs.promises.mkdir(tmpPath);
    await fs.promises.writeFile(path.join(tmpPath, 'readme.txt'), '');
    if (options.pathToExistFixtures) {
        const existDataPathName = path.resolve(tmpPath, options.roomName);
        await fsExtra.copy(options.pathToExistFixtures, existDataPathName);
    }

    const git: SimpleGit = gitP(tmpPath);
    await git.init();
    await git.add('./*');
    await git.addConfig('user.name', 'Some One');
    await git.addConfig('user.email', 'some@one.com');
    await git.commit('first commit!');
    await git.addRemote('origin', remote);
    await git.push('origin', 'master');
};
