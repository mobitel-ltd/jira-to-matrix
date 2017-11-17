const config = require('../config');
const {webHookUser} = require('../jira');
const logger = require('debug')('bot stop if ignored');

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
    if (ignore) {
        logger(`User "${username}" ignored according to config`);
        return ignore;
    }
    return;
};
