const logger = require('../modules/log.js')(module);
const helper = require('../bot/actions/helper');
const messages = require('../lib/messages');

module.exports = async (body, usersToIgnore, testMode) => {
    const projectStatus = await helper.getIgnoreProject(body, usersToIgnore, testMode);
    const msg = messages.getWebhookStatusLog({ projectStatus });

    logger.info(msg);

    // return userStatus.ignoreStatus || projectStatus.ignoreStatus;
    return projectStatus.ignoreStatus;
};
