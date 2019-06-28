const utils = require('../../lib/utils');
const logger = require('../../modules/log.js')(module);
const {getIssueUpdateInfoMessageBody} = require('./helper.js');

/**
 * post issue update
 * @param  {object} options options
 * @param  {object} options.chatApi messenger client instance
 * @param  {string} options.oldKey old key of issue
 * @param  {string?} options.newKey new key of issue
 * @param  {Object?} options.newNameData new name of room
 * @param  {object} options.changelog changes object
 * @param  {string} options.author changes author
 */
module.exports = async ({chatApi, ...body}) => {
    try {
        const roomID = await chatApi.getRoomId(body.oldKey);

        if (body.newKey) {
            const topic = utils.getViewUrl(body.newKey);
            await chatApi.updateRoomData(roomID, topic, body.newKey);
            logger.debug(`Added new topic ${body.newKey} for room ${body.oldKey}`);
        }

        if (body.newNameData) {
            await chatApi.updateRoomName(roomID, body.newNameData);
            logger.debug(`Room ${body.oldKey} name updated`);
        }

        const info = await getIssueUpdateInfoMessageBody(body);
        await chatApi.sendHtmlMessage(roomID, info.body, info.htmlBody);
        logger.debug(`Posted updates to ${roomID}`);

        return true;
    } catch (err) {
        throw utils.errorTracing('postIssueUpdates', err);
    }
};
