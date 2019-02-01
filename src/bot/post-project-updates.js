const {getNewEpicMessageBody, getEpicChangedMessageBody} = require('./helper.js');

const getMsg = {
    'issue_created': getNewEpicMessageBody,
    'issue_generic': getEpicChangedMessageBody,
};
module.exports = async ({mclient, typeEvent, projectKey, data}) => {
    try {
        const roomId = await mclient.getRoomId(projectKey);

        const {body, htmlBody} = getMsg[typeEvent](data);
        await mclient.sendHtmlMessage(roomId, body, htmlBody);

        return true;
    } catch (err) {
        throw ['Error in postProjectUpdates', err].join('\n');
    }
};
