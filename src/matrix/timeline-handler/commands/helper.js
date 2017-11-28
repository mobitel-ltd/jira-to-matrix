const getAllUsers = require('../../../utils/get-all-from-jira');

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


// Search users by part of name
const searchUser = async name => {
    const allUsers = await getAllUsers();

    if (allUsers.status >= 400) {
        throw new Error('Jira not return list all users!');
    }

    return allUsers.reduce((prev, cur) =>
        (checkUser(cur, name) ? [...prev, cur] : prev),
    []);
};

module.exports = {
    searchUser,
    checkUser,
    checkCommand,
    checkNamePriority,
    BASE_URL: 'https://jira.bingo-boom.ru/jira/rest/api/2/issue',
};
