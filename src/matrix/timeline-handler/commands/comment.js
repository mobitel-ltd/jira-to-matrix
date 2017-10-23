const jiraRequest = require('../../../utils');
const {auth} = require('../../../jira');
const translate = require('../../../locales');
const {schemaComment} = require('./schemas.js');
const {BASE_URL} = require('./helper.js');

module.exports = async ({body, sender, room, roomName, matrixClient}) => {
    const message = body.substring(9).trim();

    // post comment in issue
    const {status} = await jiraRequest.fetchPostJSON(
        `${BASE_URL}/${roomName}/comment`,
        auth(),
        schemaComment(sender, message)
    );

    if (status !== 201) {
        const post = translate('errorMatrixComment');
        await matrixClient.sendHtmlMessage(room.roomId, post, post);
        return `
            Comment from ${sender} for ${roomName} not published
            \nJira have status ${status}
        `;
    }

    const post = translate('successMatrixComment');
    await matrixClient.sendHtmlMessage(room.roomId, post, post);
    return `Comment from ${sender} for ${roomName}`;
};
