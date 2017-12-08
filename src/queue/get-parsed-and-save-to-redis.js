const {getFuncAndBody} = require('./bot-handler.js');
const {isIgnore, newSave} = require('../bot');
const logger = require('../modules/log.js')(module);


module.exports = async body => {
    try {
        isIgnore(body);
        const parsedBody = getFuncAndBody(body);
        await Promise.all(parsedBody.map(newSave));

        return true;
    } catch (err) {
        logger.warn('Error in parsing ', err);

        return false;
    }
};
