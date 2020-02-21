const jiraRequests = require('../../../lib/jira-request');
const utils = require('../../../lib/utils');
const translate = require('../../../locales');

const getMDtext = messages => messages.map(({ author, date, body }) => `${date}  \n${author}  \n${body}`).join('* * *');

module.exports = async ({ bodyText, roomId, roomName, sender, chatApi }) => {
    const issue = await jiraRequests.getIssue(roomName);
    const creatorIssueName = utils.getIssueCreator(issue);
    const assigneeIssueName = utils.getIssueAssignee(issue);
    const roomAdmins = await chatApi.getRoomAdmins({ roomId });
    const admins = [creatorIssueName, assigneeIssueName, ...roomAdmins].filter(Boolean);
    const members = await chatApi.getRoomMembers(roomName);
    const { displayName: senderDisplayName = '' } = await chatApi.getUser(chatApi.getChatUserId(sender));

    if (!admins.includes(senderDisplayName)) {
        return translate('notAdmin', { sender });
    }

    const allMessages = await chatApi.getAllMessagesFromRoom(roomId);

    const allMessagesMDtext = getMDtext(allMessages);

    return 'ok';
    return `${allMessagesMDtext}`;
};
