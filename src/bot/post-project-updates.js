const {getNewEpicMessageBody, getEpicChangedMessageBody} = require('./helper.js');
const logger = require('../modules/log.js')(module);

module.exports = async ({mclient, typeEvent, projectOpts, data}) => {
    logger.debug('Post project updates start');
    try {
        const roomId = await mclient.getRoomId(projectOpts.key);
        logger.debug('roomID', roomId);

        if (typeEvent === 'issue_created') {
            const {body, htmlBody} = getNewEpicMessageBody(data);
            await mclient.sendHtmlMessage(roomId, body, htmlBody);
        }

        if (typeEvent === 'issue_generic') {
            const {body, htmlBody} = getEpicChangedMessageBody(data);
            await mclient.sendHtmlMessage(roomId, body, htmlBody);
        }

        return true;
    } catch (err) {
        throw ['Error in postProjectUpdates', err].join('\n');
    }
};
