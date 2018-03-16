const logger = require('../modules/log.js')(module);
const isIgnore = require('./helper');

module.exports = body => {
    const {ignoreStatus, username, creator} = isIgnore(body);
    logger.info(`User "${username}", creator "${creator}" ignored status: ${ignoreStatus}`);

    if (ignoreStatus) {
        throw 'User ignored';
    }
};
