const jiraRequests = require('../../lib/jira-request');
const messages = require('../../lib/messages');
const utils = require('../../lib/utils');
const translate = require('../../locales');

module.exports = async ({bodyText, sender, room, roomName, chatApi}) => {
    try {
        if (bodyText) {
            await jiraRequests.postComment(roomName, sender, bodyText);

            return messages.getCommentSuccessSentLog(sender, roomName);
        }

        const body = translate('emptyMatrixComment');
        await chatApi.sendHtmlMessage(room.roomId, body, body);

        return messages.getCommentFailSentLog(sender, roomName);
    } catch (err) {
        throw utils.errorTracing('Matrix Comment command', err);
    }
};
