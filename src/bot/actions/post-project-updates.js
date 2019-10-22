const { getNewEpicMessageBody, getEpicChangedMessageBody } = require('./helper.js');

const getMsg = {
    issue_created: getNewEpicMessageBody,
    issue_generic: getEpicChangedMessageBody,
};
module.exports = async ({ chatApi, typeEvent, projectKey, data }) => {
    try {
        const roomId = await chatApi.getRoomId(projectKey);

        const { body, htmlBody } = getMsg[typeEvent](data);
        await chatApi.sendHtmlMessage(roomId, body, htmlBody);

        return true;
    } catch (err) {
        throw ['Error in postProjectUpdates', err].join('\n');
    }
};
