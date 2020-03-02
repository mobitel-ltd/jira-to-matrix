const { gitArchive } = require('../../../config');
const fsPromises = require('fs').promises;
const path = require('path');
const os = require('os');
const git = require('simple-git/promise');
const Ramda = require('ramda');
const jiraRequests = require('../../../lib/jira-request');
const utils = require('../../../lib/utils');
const translate = require('../../../locales');
const logger = require('../../../modules/log.js')(module);

const getMDtext = messages =>
    messages.map(({ author, date, body }) => [date, author, body].join('\n')).join(`\n\n---\n\n`);

const getHTMLtext = messages =>
    messages.map(({ author, date, body }) => [date, author, body].join('<br>')).join(`\n<br><hr>`);

const gitPullToRepo = async (gitParams, listEvents, projectKey, roomName) => {
    const tmpPath = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'arhive-'));
    const { user, password, repoPrefix } = gitParams;
    const remote = `https://${user}:${password}@${repoPrefix}${projectKey}.git`;
    await git(tmpPath).clone(remote);
    const repoPath = `${tmpPath}/${projectKey}`;
    const repoRoomPath = `${repoPath}/${roomName}`;
    const repoRoomResPath = `${repoRoomPath}/res`;
    await fsPromises.mkdir(repoRoomResPath, { recursive: true });
    const renderedText = getMDtext(listEvents);
    await fsPromises.writeFile(path.join(repoRoomPath, `${roomName}.md`), renderedText);

    await Promise.all(
        listEvents.map(async event => {
            await fsPromises.writeFile(path.join(repoRoomResPath, `${event.eventId}.json`), JSON.stringify(event));
        }),
    );

    await git(repoPath).add('./*');
    await git(repoPath).commit('first commit!');
    await git(repoPath).push('origin', 'master');

    return tmpPath;
};

const archive = async ({ bodyText, roomId, roomName, sender, chatApi }) => {
    try {
        // 1. Permitions
        const issue = await jiraRequests.getIssue(roomName);
        const projectKey = utils.getProjectKeyFromIssueKey(roomName);
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
        const allMessages = await chatApi.getAllMessagesFromRoom(roomId);

        // return tmpPath
        await gitPullToRepo(gitArchive, allMessages, projectKey, roomName);

        // 3. Kick if was flag
        const members = await chatApi.getRoomMembers({ roomId });
        const membersNotAdmins = Ramda.difference(members, matrixRoomAdmins.map(({ userId }) => userId)).filter(
            Boolean,
        );

        // TODO add removing alias
        if (bodyText.includes === 'KICKALL') {
            await Promise.all(
                membersNotAdmins.map(async userId => {
                    await chatApi.kickUserByRoom({ roomId, userId });
                    logger.info(`Member ${userId} kicked from ${roomId}`);
                }),
            );
            await Promise.all(
                matrixRoomAdmins.map(async ({ userId }) => {
                    await chatApi.kickUserByRoom({ roomId, userId });
                    logger.info(`Admin ${userId} kicked from ${roomId}`);
                }),
            );
        }
    } catch (err) {
        logger.error(err);
    }
};

module.exports = {
    archive,
    getHTMLtext,
    getMDtext,
    gitPullToRepo,
};
