const utils = require('../../lib/utils');
const logger = require('../../modules/log.js')(module);
const {getIssueUpdateInfoMessageBody} = require('./helper.js');

/**
 * post issue update
 * @param  {object} options options
 * @param  {object} options.chatApi messenger client instance
 * @param  {string} options.oldKey old key of issue
 * @param  {string?} options.newKey new key of issue
 * @param  {string?} options.newName new name of room
 * @param  {object} options.changelog changes object
 * @param  {string} options.author changes author
 */
module.exports = async ({chatApi, ...body}) => {
    try {
        const roomID = await chatApi.getRoomId(body.oldKey);

        if (body.newKey) {
            await chatApi.createAlias(body.newKey, roomID);
            logger.debug(`Added alias ${body.newKey} for room ${body.oldKey}`);

            await chatApi.setRoomTopic(roomID, utils.getViewUrl(body.newKey));
            logger.debug(`Added new topic ${body.newKey} for room ${body.oldKey}`);
        }

        if (body.newName) {
            await chatApi.setRoomName(roomID, body.newName);
            logger.debug(`Renamed room ${body.oldKey}`);
        }

        const info = await getIssueUpdateInfoMessageBody(body);
        await chatApi.sendHtmlMessage(roomID, info.body, info.htmlBody);
        logger.debug(`Posted updates to ${roomID}`);

        return true;
    } catch (err) {
        throw utils.errorTracing('postIssueUpdates', err);
    }
};
