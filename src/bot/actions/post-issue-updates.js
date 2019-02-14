const utils = require('../../lib/utils');
const logger = require('../../modules/log.js')(module);
const {getIssueUpdateInfoMessageBody} = require('./helper.js');

const postUpdateInfo = async (chatApi, roomID, data) => {
    try {
        const {body, htmlBody} = await getIssueUpdateInfoMessageBody(data);
        await chatApi.sendHtmlMessage(roomID, body, htmlBody);

        logger.debug(`Posted updates to ${roomID}`);
    } catch (err) {
        throw utils.errorTracing('postUpdateInfo', err);
    }
};

const move = async (chatApi, roomID, {issueKey, fieldKey, summary}) => {
    if (!(fieldKey && summary)) {
        return;
    }
    try {
        await chatApi.createAlias(fieldKey.toString, roomID);
        logger.debug(`Successfully added alias ${fieldKey.toString} for room ${fieldKey.fromString}`);

        await chatApi.setRoomTopic(roomID, utils.getViewUrl(issueKey));
    } catch (err) {
        throw utils.errorTracing('move issue', err);
    }
};

const rename = async (chatApi, roomID, {summary, roomName, issueKey}) => {
    if (!summary) {
        return;
    }

    const result = await chatApi.setRoomName(roomID, roomName);
    const status = result ? 'Successfully' : 'Unsuccessfullly';
    logger.debug(`${status} renamed room ${issueKey}`);
};

module.exports = async ({chatApi, ...body}) => {
    try {
        const roomID = await chatApi.getRoomId(body.issueKey);

        await move(chatApi, roomID, body);
        await rename(chatApi, roomID, body);
        await postUpdateInfo(chatApi, roomID, body);

        return true;
    } catch (err) {
        throw utils.errorTracing('postIssueUpdates', err);
    }
};
