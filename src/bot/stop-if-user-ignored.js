const config = require('../config');
const {webHookUser} = require('../jira');
const logger = require('simple-color-logger')();

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

async function middleware(req) {
    const {ignore, username} = shouldIgnore(req.body, config);
    if (ignore) {
        logger.warn(`User "${username}" ignored according to config`);
        return ignore;
    }
    return undefined;
}

module.exports = middleware;
