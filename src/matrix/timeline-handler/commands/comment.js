const jiraRequest = require('../../../utils');
const {auth} = require('../../../jira');
const translate = require('../../../locales');
const {schemaComment} = require('./schemas.js');
const {BASE_URL} = require('./helper.js');

module.exports = async ({bodyText, sender, room, roomName, matrixClient}) => {
    try {
        // post comment in issue
        await jiraRequest.requestPost(
            `${BASE_URL}/${roomName}/comment`,
            auth(),
            schemaComment(sender, bodyText)
        );
        return `Comment from ${sender} for ${roomName}`;
    } catch (err) {
        const post = translate('errorMatrixComment');
        await matrixClient.sendHtmlMessage(room.roomId, post, post);

        return `
            Comment from ${sender} for ${roomName} not published
            \n${err}
        `;
    }
};
