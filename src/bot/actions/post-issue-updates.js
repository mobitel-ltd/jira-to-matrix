const utils = require('../../lib/utils');
const logger = require('../../modules/log.js')(module);
const { getIssueUpdateInfoMessageBody, getNewAvatarUrl } = require('./helper.js');
const config = require('../../config');
const ramda = require('ramda');

/**
 * post issue update
 * @param  {object} options options
 * @param  {object} options.chatApi messenger client instance
 * @param  {string} options.oldKey old key of issue
 * @param  {string?} options.newKey new key of issue
 * @param  {Object?} options.newNameData new name of room
 * @param  {object} options.changelog changes object\
 * @param  {string} options.author changes author
 * @param  {string?} options.newStatusId new status id for issue
 */
module.exports = async ({ chatApi, newStatusId, ...body }) => {
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

        const newAvatarUrl = await getNewAvatarUrl(body.oldKey, {
            statusId: newStatusId,
            colors: ramda.path(['colors', 'links'], config),
            usingPojects: ramda.path(['colors', 'projects'], config),
        });

        if (newAvatarUrl) {
            await chatApi.setRoomAvatar(roomID, newAvatarUrl);

            logger.debug(`Room ${roomID} have got new avatar ${newAvatarUrl}`);
        }

        return true;
    } catch (err) {
        throw utils.errorTracing('postIssueUpdates', err);
    }
};
