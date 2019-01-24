const logger = require('../modules/log.js')(module);
const {getIgnoreInfo} = require('../bot/helper.js');
const messages = require('../lib/messages');

module.exports = async body => {
    const ignoreInfo = await getIgnoreInfo(body);
    const msg = messages.getWebhookStatusLog(ignoreInfo);
    logger.info(msg);

    return ignoreInfo.status;
};
