const jiraRequests = require('../../../lib/jira-request');
const translate = require('../../../locales');
const messages = require('../../../lib/messages');
const utils = require('../../../lib/utils');

module.exports = async ({bodyText, roomId, sender, roomName, chatApi}) => {
    try {
        const transitions = await jiraRequests.getPossibleIssueStatuses(roomName);
        if (!bodyText) {
            const list = utils.getCommandList(transitions);
            await chatApi.sendHtmlMessage(roomId, list, list);

            return;
        }

        const newStatus = utils.getCommandAction(bodyText, transitions);

        if (!newStatus) {
            const post = translate('notFoundMove', {bodyText});
            await chatApi.sendHtmlMessage(roomId, post, post);

            return messages.getNotFoundMoveCommandLog(roomName, bodyText);
        }

        await jiraRequests.postIssueStatus(roomName, newStatus.id);
        const post = translate('successMoveJira', {...newStatus, sender});
        await chatApi.sendHtmlMessage(roomId, post, post);

        return messages.getMoveSuccessLog(roomName);
    } catch (err) {
        throw utils.errorTracing('Matrix Move command', err);
    }
};
