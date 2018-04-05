const querystring = require('querystring');
const {auth} = require('../../../jira/common.js');

const {request} = require('../../../utils');
const {jira} = require('../../../config');
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
            auth()
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


module.exports = {
    checkUser,
    checkCommand,
    checkNamePriority,
    searchUser,
    getAllUsers,
    BASE_URL,
    parseEventBody,
    getUsers,
};
