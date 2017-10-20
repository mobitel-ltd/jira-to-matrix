const checkUser = (users, name) =>
    ~users.name.toLowerCase().indexOf(name.toLowerCase())
    || ~users.displayName.toLowerCase().indexOf(name.toLowerCase());

const checkCommand = (body, name, index) =>
    ~body.toLowerCase().indexOf(name.toLowerCase())
    || ~body.indexOf(String(index + 1));

const checkNamePriority = (priority, index, name) =>
    priority.name.toLowerCase() === name.toLowerCase()
    || String(index + 1) === name;

module.exports = {
    checkUser,
    checkCommand,
    checkNamePriority,
};
