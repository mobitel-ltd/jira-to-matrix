const querystring = require('querystring');
const {auth} = require('../../../jira/common.js');

const logger = require('simple-color-logger')();
const {fetchJSON} = require('../../../utils');
const {jira} = require('../../../config');
const {url} = jira;

// Checking occurrences of current name
const checkUser = (user, name) =>
    ~user.name.toLowerCase().indexOf(name.toLowerCase())
    || ~user.displayName.toLowerCase().indexOf(name.toLowerCase());

const checkCommand = (body, name, index) =>
    ~body.toLowerCase().indexOf(name.toLowerCase())
    || ~body.indexOf(String(index + 1));

const checkNamePriority = (priority, index, name) =>
    priority.name.toLowerCase() === name.toLowerCase()
    || String(index + 1) === name;

// recursive function to get users by num and startAt (start position in jira list of users)
const getUsers = async (num, startAt, acc) => {
    const params = {
        username: '@boom',
        startAt,
        maxResults: num,
    };

    const queryPararms = querystring.stringify(params);

    const users = await fetchJSON(
        `${url}/rest/api/2/user/search?${queryPararms}`,
        auth()
    );
    let resultAcc = [...acc, ...users];
    if (users.length >= num) {
        resultAcc = await getUsers(num, startAt + num, resultAcc);
    }
    logger.info('Number of users', resultAcc.length);
    return resultAcc;
};

// Let get all users even if they are more 1000
const getAllUsers = async () => {
    const MAX_USERS = 999;
    const START_AT = 0;
    const START_ACC = [];
    // eslint-disable-next-line
    try {
        const allUsers = await getUsers(MAX_USERS, START_AT, START_ACC);
        return allUsers;
    } catch (err) {
        logger.error('Error in users request', err);
        throw new Error('Error in users request');
    }
};

// Search users by part of name
const searchUser = async name => {
    try {
        const allUsers = await getAllUsers();

        const filteredUsers = allUsers.reduce((prev, cur) =>
            (checkUser(cur, name) ? [...prev, cur] : prev),
        []);
        logger.info('Search users by name is ok');
        return filteredUsers;
    } catch (err) {
        logger.error('Search users is failed', err);
        throw new Error('Jira not return list all users!');
    }
};

const BASE_URL = `${url}/rest/api/2/issue`;

module.exports = {
    checkUser,
    checkCommand,
    checkNamePriority,
    searchUser,
    getAllUsers,
    BASE_URL,
};
