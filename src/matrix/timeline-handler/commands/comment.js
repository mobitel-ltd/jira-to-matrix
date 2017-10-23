const jiraRequest = require('../../../utils');
const {auth} = require('../../../jira');
const translate = require('../../../locales');
const {schemaComment} = require('./schemas.js');
const {BASE_URL} = require('./helper.js');

module.exports = async ({body, sender, room, roomName, self}) => {
    const message = body.substring(9).trim();

    // post comment in issue
    const jiraComment = await jiraRequest.fetchPostJSON(
        `${BASE_URL}/${roomName}/comment`,
        auth(),
        schemaComment(sender, message)
    );

    if (jiraComment.status !== 201) {
        const post = translate('errorMatrixComment');
        await self.sendHtmlMessage(room.roomId, post, post);
        return `
            Comment from ${sender} for ${roomName} not published
            \nJira have status ${jiraComment.status}
        `;
    }

    const post = translate('successMatrixComment');
    await self.sendHtmlMessage(room.roomId, post, post);
    return `Comment from ${sender} for ${roomName}`;
};
