// const logger = require('../../modules/log.js')(module);

const checkUser = (users, name) =>
    ~users.name.toLowerCase().indexOf(name.toLowerCase())
    || ~users.displayName.toLowerCase().indexOf(name.toLowerCase());

const checkCommand = (body, name, index) =>
    ~body.toLowerCase().indexOf(name.toLowerCase())
    || ~body.indexOf(String(index + 1));

const checkNamePriority = (priority, index, name) =>
    priority.name.toLowerCase() === name.toLowerCase()
    || String(index + 1) === name;

const parseBody = body => {
    try {
        const commandName = body
            .split(' ')[0]
            .match(/^!\w+$/g)[0]
            .substring(1);
        const bodyText = body.replace(`!${commandName} `, '');
        return {commandName, bodyText};
    } catch (err) {
        return null;
    }
};

module.exports = {
    checkUser,
    checkCommand,
    checkNamePriority,
    parseBody,
};
