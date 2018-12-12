const querystring = require('querystring');
const logger = require('../../../modules/log')(module);
const {schemaWatcher} = require('./schemas.js');
const {requestPost, request} = require('../../../lib/request.js');
const translate = require('../../../locales');

const {jira, matrix} = require('../../../config');
const {userId: botId} = matrix;
const {url} = jira;
const {getUserID} = require('../../../bot/helper.js');
const {COMMON_NAME, getRestUrl} = require('../../../lib/utils.js');
const BASE_URL = getRestUrl('issue');

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


const getUserByParam = username => {
    try {
        const queryPararms = querystring.stringify({username});

        return request(`${url}/rest/api/2/user/search?${queryPararms}`);
    } catch (err) {
        throw ['getUserByParam error', err].join('\n');
    }
};
// recursive function to get users by num and startAt (start position in jira list of users)
const getUsers = async (maxResults, startAt, acc = []) => {
    try {
        const params = {
            username: COMMON_NAME,
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
        const allUsers = await getUserByParam(name);

        return allUsers.reduce((prev, cur) =>
            (checkUser(cur, name) ? [...prev, cur] : prev),
        []);
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
    const user = getUserID(assignee);
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
        const watchersUrl = getRestUrl('issue', roomName, 'watchers');
        return requestPost(watchersUrl, schemaWatcher(name));
    } catch (err) {
        throw ['addAssigneeInWatchers error', err].join('\n');
    }
};


const getMembersExceptBot = joinedMembers =>
    joinedMembers.reduce((acc, {userId}) =>
        (userId === botId ? acc : [...acc, userId]), []);

const newYear2018 = new Date(Date.UTC(2018, 0, 1, 3));

const getLimit = () => newYear2018.getTime();

// should get room info, timestamp and date of event, and all members except jira-bot
const parseRoom = (acc, room) => {
    const {roomId, name: roomName} = room;
    const members = getMembersExceptBot(room.getJoinedMembers());
    const [lastEvent] = room.timeline.slice(-1);

    if (!lastEvent) {
        return acc;
    }

    const timestamp = lastEvent.getTs();
    const date = lastEvent.getDate();
    const result = {
        room: {roomId, roomName},
        timestamp,
        date,
        members,
    };
    // logger.debug('Room data after parsing for kicking', result);

    return [...acc, result];
};

// const sortNewToOld = (room1, room2) =>
//     room2.timestamp - room1.timestamp;

const getOutdatedRoomsWithSender = userId => ({timestamp, members}) =>
    (timestamp < getLimit()) && members.some(member => member.includes(userId));

const getRoomsLastUpdate = (rooms, userId) =>
    rooms
        .reduce(parseRoom, [])
        .filter(getOutdatedRoomsWithSender(userId));
// next one should be deleted
// .sort(sortNewToOld);

const kickUser = client => async (user, {roomId, roomName}) => {
    try {
        await client.kick(roomId, user, 'This room is outdated');

        return translate('successUserKick', {user, roomName});
    } catch (err) {
        const msg = translate('errorUserKick', {user, roomName});
        logger.warn([msg, err].join('\n'));

        return msg;
    }
};

const kickAllMembers = mclient => ({members, room}) =>
    Promise.all(members.map(user =>
        kickUser(mclient)(user, room)));

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
