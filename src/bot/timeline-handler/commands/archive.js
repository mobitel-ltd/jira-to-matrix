const config = require('../../../config');
const fs = require('fs').promises;
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

const EVENTS_DIR_NAME = 'res';

const gitPullToRepo = async (baseRemote, listEvents, projectKey, roomName) => {
    try {
        const tmpPath = await fs.mkdtemp(path.join(os.tmpdir(), 'arhive-'));
        const remote = `${baseRemote}${projectKey}.git`;
        const localGit = git(tmpPath);
        await localGit.clone(remote, projectKey);
        const repoPath = path.resolve(tmpPath, projectKey);
        const repoRoomPath = path.resolve(repoPath, roomName);
        const repoRoomResPath = path.resolve(repoRoomPath, EVENTS_DIR_NAME);
        await fs.mkdir(repoRoomResPath, { recursive: true });
        // const renderedText = getMDtext(listEvents);
        // await fs.writeFile(path.join(repoRoomPath, `${roomName}.md`), renderedText);

        await Promise.all(
            listEvents.map(async event => {
                await fs.writeFile(path.join(repoRoomResPath, `${event.event_id}.json`), JSON.stringify(event));
            }),
        );

        const repoGit = git(repoPath);

        repoGit.addConfig('user.name', 'Some One');
        repoGit.addConfig('user.email', 'some@one.com');

        await repoGit.add('./*');
        await repoGit.commit('first commit!');
        await repoGit.push('origin', 'master');

        return remote;
    } catch (err) {
        logger.error(err);
    }
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
        const remote = await gitPullToRepo(config.baseRemote, allMessages, projectKey, roomName);

        if (!remote) {
            return translate('gitCommand', { projectKey });
        }

        logger.debug(`Git push successfully complited!!!`);

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
    EVENTS_DIR_NAME,
};
