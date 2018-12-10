const {getNewEpicMessageBody, getEpicChangedMessageBody} = require('./helper.js');

module.exports = async ({mclient, typeEvent, projectOpts, data}) => {
    try {
        const roomId = await mclient.getRoomId(projectOpts.key);
        if (!roomId) {
            throw `No roomId for ${projectOpts.key}`;
        }

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
