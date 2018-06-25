const {requestPost} = require('../../../lib/request.js');
const translate = require('../../../locales');
const {schemaComment} = require('./schemas.js');
const {BASE_URL} = require('./helper.js');

module.exports = async ({bodyText, sender, room, roomName, matrixClient}) => {
    try {
        // post comment in issue
        await requestPost(
            `${BASE_URL}/${roomName}/comment`,
            schemaComment(sender, bodyText)
        );
        return `Comment from ${sender} for ${roomName}`;
    } catch (err) {
        const post = translate('errorMatrixComment');
        await matrixClient.sendHtmlMessage(room.roomId, post, post);

        return [`Comment from ${sender} for ${roomName} not published`, err].join('\n');
    }
};
