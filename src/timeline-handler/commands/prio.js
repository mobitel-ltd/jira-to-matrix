const jiraRequests = require('../../lib/jira-request');
const translate = require('../../locales');
const messages = require('../../lib/messages');
const utils = require('../../lib/utils');

module.exports = async ({bodyText, room, roomName, chatApi}) => {
    try {
        const allPriorities = await jiraRequests.getIssuePriorities(roomName);

        if (!bodyText) {
            const listPrio = utils.getCommandList(allPriorities);
            await chatApi.sendHtmlMessage(room.roomId, listPrio, listPrio);

            return;
        }

        const priority = utils.getCommandAction(bodyText, allPriorities);

        if (!priority) {
            const post = translate('notFoundPrio', {bodyText});
            await chatApi.sendHtmlMessage(room.roomId, post, post);

            return messages.getNotFoundPrioCommandLog(roomName, bodyText);
        }

        await jiraRequests.updateIssuePriority(roomName, priority.id);

        const post = translate('setPriority', priority);
        await chatApi.sendHtmlMessage(room.roomId, post, post);

        return messages.getUpdatedIssuePriorityLog(roomName, priority.name);
    } catch (err) {
        throw utils.errorTracing('Matrix prio command', err);
    }
};
