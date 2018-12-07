const logger = require('../modules/log.js')(module);
const {getFuncAndBody} = require('./bot-handler.js');
const isIgnore = require('./is-ignore');
const {saveIncoming} = require('../queue/redis-data-handle.js');

module.exports = async body => {
    try {
        await isIgnore(body);
        const parsedBody = getFuncAndBody(body);
        await Promise.all(parsedBody.map(saveIncoming));

        return true;
    } catch (err) {
        logger.warn('Error in parsing ', err);

        return false;
    }
};
