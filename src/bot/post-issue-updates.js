const utils = require('../lib/utils');
const logger = require('../modules/log.js')(module);
const {getIssueUpdateInfoMessageBody} = require('./helper.js');

const postUpdateInfo = async (mclient, roomID, data) => {
    try {
        const {body, htmlBody} = await getIssueUpdateInfoMessageBody(data);
        await mclient.sendHtmlMessage(roomID, body, htmlBody);

        logger.debug(`Posted updates to ${roomID}`);
    } catch (err) {
        throw utils.errorTracing('postUpdateInfo', err);
    }
};

const move = async (mclient, roomID, {issueKey, fieldKey, summary}) => {
    if (!(fieldKey && summary)) {
        return;
    }
    try {
        await mclient.createAlias(fieldKey.toString, roomID);
        logger.debug(`Successfully added alias ${fieldKey.toString} for room ${fieldKey.fromString}`);

        await mclient.setRoomTopic(roomID, utils.getViewUrl(issueKey));
    } catch (err) {
        throw utils.errorTracing('move issue', err);
    }
};

const rename = async (mclient, roomID, {summary, roomName, issueKey}) => {
    if (!summary) {
        return;
    }

    const result = await mclient.setRoomName(roomID, roomName);
    const status = result ? 'Successfully' : 'Unsuccessfullly';
    logger.debug(`${status} renamed room ${issueKey}`);
};

module.exports = async ({mclient, ...body}) => {
    try {
        const roomID = await mclient.getRoomId(body.issueKey);

        await move(mclient, roomID, body);
        await rename(mclient, roomID, body);
        await postUpdateInfo(mclient, roomID, body);

        return true;
    } catch (err) {
        throw utils.errorTracing('postIssueUpdates', err);
    }
};
