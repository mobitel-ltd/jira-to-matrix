const jiraRequest = require('../../../utils');
const {auth} = require('../../../jira');

const checkUser = (users, name) =>
    ~users.name.toLowerCase().indexOf(name.toLowerCase())
    || ~users.displayName.toLowerCase().indexOf(name.toLowerCase());

const checkCommand = (body, name, index) =>
    ~body.toLowerCase().indexOf(name.toLowerCase())
    || ~body.indexOf(String(index + 1));

const checkNamePriority = (priority, index, name) =>
    priority.name.toLowerCase() === name.toLowerCase()
    || String(index + 1) === name;

const searchUser = async name => {
    const allUsers = await jiraRequest.fetchJSON(
        `https://jira.bingo-boom.ru/jira/rest/api/2/user/search?maxResults=1000&username=@boom`,
        auth()
    );

    if (allUsers.status >= 400) {
        throw new Error('Jira not return list all users!');
    }

    const result = allUsers.reduce((prev, cur) => {
        if (checkUser(cur, name)) {
            prev.push(cur);
        }

        return prev;
    }, []);

    return result;
};

module.exports = {
    searchUser,
    checkUser,
    checkCommand,
    checkNamePriority,
    BASE_URL: 'https://jira.bingo-boom.ru/jira/rest/api/2/issue',
};
