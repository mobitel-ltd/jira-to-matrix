const jiraRequest = require('../../../utils');
const {auth} = require('../../../jira');
const translate = require('../../../locales');
const {schemaComment} = require('./schemas.js');
const {BASE_URL} = require('./helper.js');
const logger = require('../../../modules/log.js')(module);

module.exports = async ({bodyText, sender, room, roomName, matrixClient}) => {
    try {
        // post comment in issue
        const status = await jiraRequest.fetchPostJSON(
            `${BASE_URL}/${roomName}/comment`,
            auth(),
            schemaComment(sender, bodyText)
        );

        if (status !== 201) {
            const post = translate('errorMatrixComment');
            await matrixClient.sendHtmlMessage(room.roomId, post, post);

            return `
                Comment from ${sender} for ${roomName} not published
                \nJira have status ${status}
            `;
        }

        return `Comment from ${sender} for ${roomName}`;
    } catch (err) {
        logger.error('Matrix comment command error');

        throw err;
    }
};
