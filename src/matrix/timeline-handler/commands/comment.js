const jiraRequests = require('../../../lib/jira-request');
const translate = require('../../../locales');
const messages = require('../../../lib/messages');

module.exports = async ({bodyText, sender, room, roomName, matrixClient}) => {
    try {
        // post comment in issue
        await jiraRequests.postComment(roomName, sender, bodyText);

        return messages.getCommentSuccessSentLog(sender, roomName);
    } catch (err) {
        const post = translate('errorMatrixComment');
        await matrixClient.sendHtmlMessage(room.roomId, post, post);

        return [messages.getCommentFailSentLog(sender, roomName), err].join('\n');
    }
};
