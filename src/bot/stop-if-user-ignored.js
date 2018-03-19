const logger = require('../modules/log.js')(module);
const {isIgnore} = require('./helper.js');

module.exports = body => {
    const {ignoreStatus, username, startEndUpdateStatus, creator} = isIgnore(body);
    // eslint-disable-next-line max-len
    logger.info(`User "${username}", creator "${creator}", start/end mode "${startEndUpdateStatus}" ignored status: ${ignoreStatus}`);

    if (ignoreStatus) {
        throw 'User ignored';
    }
};
