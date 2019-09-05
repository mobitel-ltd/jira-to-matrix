const logger = require('../modules/log.js')(module);
const helper = require('../bot/actions/helper');
const messages = require('../lib/messages');

module.exports = async body => {
    const userStatus = helper.getIgnoreBodyData(body);
    const projectStatus = await helper.getIgnoreProject(body);

    const msg = messages.getWebhookStatusLog({userStatus, projectStatus});
    logger.info(msg);

    return userStatus.ignoreStatus || projectStatus.ignoreStatus;
};

