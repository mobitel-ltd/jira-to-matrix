const querystring = require('querystring');
// const logger = require('../../../modules/log')(module);
const {schemaWatcher} = require('./schemas.js');
const {requestPost, request} = require('../../../lib/request.js');

const {jira, matrix} = require('../../../config');
const {domain, userId: botId} = matrix;
const {url} = jira;

const BASE_URL = `${url}/rest/api/2/issue`;

// Checking occurrences of current name
const checkUser = ({name, displayName}, expectedName) =>
    name.toLowerCase().includes(expectedName.toLowerCase())
    || displayName.toLowerCase().includes(expectedName.toLowerCase());

const checkCommand = (body, name, index) =>
    body.toLowerCase() === name.toLowerCase()
    || body.includes(String(index + 1));

const checkNamePriority = (priority, index, name) =>
    priority.name.toLowerCase() === name.toLowerCase()
    || String(index + 1) === name;

// recursive function to get users by num and startAt (start position in jira list of users)
const getUsers = async (maxResults, startAt, acc = []) => {
    try {
        const params = {
            username: '@boom',
            startAt,
            maxResults,
        };

        const queryPararms = querystring.stringify(params);

        const users = await request(
            `${url}/rest/api/2/user/search?${queryPararms}`,
        );
        let resultAcc = [...acc, ...users];
        if (users.length >= maxResults) {
            resultAcc = await getUsers(maxResults, startAt + maxResults, resultAcc);
        }

        return resultAcc;
    } catch (err) {
        throw ['getUsers error', err].join('\n');
    }
};

// Let get all users even if they are more 1000
const MAX_USERS = 999;
const START_AT = 0;

const getAllUsers = async () => {
    try {
        const allUsers = await getUsers(MAX_USERS, START_AT);
        return allUsers;
    } catch (err) {
        throw ['Error in users request', err].join('\n');
    }
};

// Search users by part of name
const searchUser = async name => {
    try {
        if (!name) {
            return [];
        }
        const allUsers = await getAllUsers();

        const filteredUsers = allUsers.reduce((prev, cur) =>
            (checkUser(cur, name) ? [...prev, cur] : prev),
        []);
        return filteredUsers;
    } catch (err) {
        throw ['Search users is failed', err].join('\n');
    }
};

// Parse body of event from Matrix
const parseEventBody = body => {
    try {
        const commandName = body
            .split(' ')[0]
            .match(/^!\w+$/g)[0]
            .substring(1);
        const bodyText = body
            .replace(`!${commandName}`, '')
            .trim();

        return {commandName, bodyText};
    } catch (err) {
        return {};
    }
};

const getInviteUser = (assignee, room) => {
    const user = `@${assignee}:${domain}`;
    const members = room.getJoinedMembers();
    const isInRoom = members.find(({userId}) => userId === user);

    return isInRoom ? false : user;
};

const addToWatchers = async (room, roomName, name, matrixClient) => {
    try {
        const inviteUser = getInviteUser(name, room);
        if (inviteUser) {
            await matrixClient.invite(room.roomId, inviteUser);
        }

        // add watcher for issue
        await requestPost(`${BASE_URL}/${roomName}/watchers`, schemaWatcher(name));
    } catch (err) {
        throw ['addAssigneeInWatchers error', err].join('\n');
    }
};


const getMembersExceptBot = joinedMembers =>
    joinedMembers.reduce((acc, {userId}) =>
        (userId === botId ? acc : [...acc, userId]), []);

const newYear2018 = new Date(2018, 0, 1, 3);

const getLimit = () => newYear2018.getTime();

const parseRoom = room => {
    const {roomId, name: roomName} = room;
    const members = getMembersExceptBot(room.getJoinedMembers());
    const [lastEvent] = room.timeline.slice(-1);
    const timestamp = lastEvent.getTs();
    const date = lastEvent.getDate();

    return {
        room: {roomId, roomName},
        timestamp,
        date,
        members,
    };
};

const sortNewToOld = (room1, room2) =>
    room2.timestamp - room1.timestamp;

const getOutdatedRoomsWithSender = userId => ({timestamp, members}) =>
    (timestamp > getLimit()) && members.includes(userId);

const getRoomsLastUpdate = (rooms, userId) =>
    rooms
        .map(parseRoom)
        .filter(getOutdatedRoomsWithSender(userId))
        // next one should be deleted
        .sort(sortNewToOld);


const kickAllMembers = mclient => ({members, room}) =>
    Promise.all(members.map(user =>
        mclient.ban(user, room)));

module.exports = {
    getOutdatedRoomsWithSender,
    parseRoom,
    getLimit,
    kickAllMembers,
    getRoomsLastUpdate,
    addToWatchers,
    checkUser,
    checkCommand,
    checkNamePriority,
    searchUser,
    getAllUsers,
    BASE_URL,
    parseEventBody,
    getUsers,
};
