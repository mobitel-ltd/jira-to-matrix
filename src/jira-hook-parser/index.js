const logger = require('../modules/log.js')(module);
const {getFuncAndBody} = require('./bot-handler.js');
const isIgnore = require('./is-ignore');
const {saveIncoming} = require('../queue/redis-data-handle.js');

module.exports = async body => {
    try {
        if (await isIgnore(body)) {
            return;
        }

        const parsedBody = getFuncAndBody(body);
        await Promise.all(parsedBody.map(saveIncoming));

        return true;
    } catch (err) {
        logger.error('Error in parsing ', err);

        return false;
    }
};
