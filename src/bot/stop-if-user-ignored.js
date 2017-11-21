const config = require('../config');
const {webHookUser} = require('../jira');
const logger = require('debug')('bot check ignored');

const shouldIgnore = (body, conf) => {
    const username = webHookUser(body);
    return {
        username,
        ignore: username && (
            conf.usersToIgnore.includes(username) ||
            (conf.testMode.on && !conf.testMode.users.includes(username))
        ),
    };
};

module.exports = req => {
    const {ignore, username} = shouldIgnore(req.body, config);
    logger(`User "${username}" ignored status: ${ignore}`);
    if (ignore) {
        throw new Error('User ignored');
    }
    // return ignore;
};
