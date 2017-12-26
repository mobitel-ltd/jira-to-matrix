const config = require('../config');
const {webHookUser} = require('../jira');
const logger = require('../modules/log.js')(module);

const isIgnore = (body, conf) => {
    const username = webHookUser(body);
    return {
        username,
        ignore: username && (
            conf.usersToIgnore.includes(username) ||
            (conf.testMode.on && !conf.testMode.users.includes(username))
        ),
    };
};

module.exports = body => {
    const {ignore, username} = isIgnore(body, config);
    logger.info(`User "${username}" ignored status: ${ignore}`);
    if (ignore) {
        throw 'User ignored';
    }
};
