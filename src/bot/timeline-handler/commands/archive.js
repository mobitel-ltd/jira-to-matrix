// const Ramda = require('ramda');
const jiraRequests = require('../../../lib/jira-request');
const utils = require('../../../lib/utils');
const translate = require('../../../locales');
const logger = require('../../../modules/log.js')(module);

module.exports = async ({ bodyText, roomId, roomName, sender, chatApi }) => {
    try {
        // 1. Permitions
        const issue = await jiraRequests.getIssue(roomName);
        // const projectKey = utils.getProjectKeyFromIssueKey(roomName);
        const creatorIssueName = utils.getIssueCreator(issue);
        const assigneeIssueName = utils.getIssueAssignee(issue);

        const matrixRoomAdmins = await chatApi.getRoomAdmins({ roomId });
        const admins = [creatorIssueName, assigneeIssueName, ...matrixRoomAdmins.map(({ name }) => name)].filter(
            Boolean,
        );

        const { displayName: senderDisplayName = '' } = await chatApi.getUser(chatApi.getChatUserId(sender));

        if (!admins.includes(senderDisplayName)) {
            return translate('notAdmin', { sender });
        }
        // 2. Handle all events and archive
        // const allEvents = await chatApi.getAllEventsFromRoom(roomId);
        // const allMessagesMDtext = utils.getMDtext(allMessages);

        // const allMessages = await chatApi.getAllMessagesFromRoom(roomId);
        // const allMessagesMDtext = utils.getMDtext(allMessages);

        // const pathTMPdirWithFiles = await utils.createDirAndSaveFiles(allMessages, allMessagesMDtext, roomName);
        // console.log('TCL: pathTMPdirWithFiles', pathTMPdirWithFiles);

        // const pathTMPgit = await utils.gitPullArchive(pathTMPdirWithFiles, projectKey);
        // console.log('TCL: pathTMPgit', pathTMPgit);

        // 3. Kick if was flag
        // const members = await chatApi.getRoomMembers({ roomId });
        // const membersNotAdmins = Ramda.difference(members, matrixRoomAdmins.map(({ userId }) => userId)).filter(
        //     Boolean,
        // );

        // await Promise.all(
        //     membersNotAdmins.map(async userId => {
        //         await chatApi.kickUserByRoom({ roomId, userId });
        //         logger.info(`Member ${userId} kicked from ${roomId}`);
        //     }),
        // );
        // await Promise.all(
        //     matrixRoomAdmins.map(async ({ userId }) => {
        //         await chatApi.kickUserByRoom({ roomId, userId });
        //         logger.info(`Admin ${userId} kicked from ${roomId}`);
        //     }),
        // );
    } catch (err) {
        logger.error(err);
    }
};
