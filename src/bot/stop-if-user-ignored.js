const config = require('../config');
const {webHookUser} = require('../jira');

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

async function middleware(req, res, next) {
    const {ignore, username} = shouldIgnore(req.body, config);
    if (ignore) {
        res.end(`User "${username}" ignored according to config`);
        return;
    }
    next();
}

module.exports = middleware;
