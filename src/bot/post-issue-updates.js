const {getProjectUrl} = require('../jira').issue;
const logger = require('../modules/log.js')(module);
const {getIssueUpdateInfoMessageBody} = require('./helper.js');

const postUpdateInfo = async (mclient, roomID, data) => {
    try {
        const {body, htmlBody} = await getIssueUpdateInfoMessageBody(data);
        await mclient.sendHtmlMessage(roomID, body, htmlBody);

        logger.debug(`Posted updates to ${roomID}`);
    } catch (err) {
        throw ['Error in postUpdateInfo', err].join('\n');
    }
};

const move = async (mclient, roomID, {issueKey, fieldKey, summary}) => {
    if (!(fieldKey && summary)) {
        logger.debug('Deny move issue operation');
        return;
    }
    try {
        await mclient.createAlias(fieldKey.toString, roomID);
        logger.debug(`Successfully added alias ${fieldKey.toString} for room ${fieldKey.fromString}`);

        await mclient.setRoomTopic(roomID, getProjectUrl(issueKey));
    } catch (err) {
        throw ['Error in move issue', err].join('\n');
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
        logger.debug('Start postIssueUpdates');

        const roomID = await mclient.getRoomId(body.issueKey);
        if (!roomID) {
            logger.warn(`No room for ${body.issueKey} in PostIssueUpdates`);
            return;
        }

        logger.debug('RoomId in Post issue updates is ', roomID);

        await move(mclient, roomID, body);
        await rename(mclient, roomID, body);
        await postUpdateInfo(mclient, roomID, body);

        return true;
    } catch (err) {
        throw ['Error in postIssueUpdates', err].join('\n');
    }
};
