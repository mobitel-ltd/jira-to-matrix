const tmp = require('tmp-promise');
const config = require('../../../config');
const fs = require('fs').promises;
const path = require('path');
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

const KICK_ALL_OPTION = 'kickall';

const getProjectRemote = (baseRemote, projectKey) => {
    const projectExt = `${projectKey.toLowerCase()}.git`;

    return [baseRemote, projectExt].join('/');
};

const gitPullToRepo = async (baseRemote, listEvents, projectKey, roomName) => {
    const { path: tmpPath, cleanup } = await tmp.dir({ unsafeCleanup: true });
    try {
        const remote = getProjectRemote(baseRemote, projectKey);
        await git(tmpPath).clone(remote, projectKey);
        const repoPath = path.resolve(tmpPath, projectKey);
        const repoRoomPath = path.resolve(repoPath, roomName);
        const repoRoomResPath = path.resolve(repoRoomPath, EVENTS_DIR_NAME);
        await fs.mkdir(repoRoomResPath, { recursive: true });
        const renderedText = getMDtext(listEvents);
        await fs.writeFile(path.join(repoRoomPath, `${roomName}.md`), renderedText);

        await Promise.all(
            listEvents.map(async event => {
                await fs.writeFile(path.join(repoRoomResPath, `${event.event_id}.json`), JSON.stringify(event));
            }),
        );

        const repoGit = git(repoPath);

        await repoGit.addConfig('user.name', 'bot');
        await repoGit.addConfig('user.email', 'bot@example.com');

        await repoGit.add('./*');
        await repoGit.commit(`set event data for room ${roomName}`);
        await repoGit.push('origin', 'master');

        return remote;
    } catch (err) {
        logger.error(err);
    } finally {
        await cleanup();
    }
};

const archive = async ({ bodyText, roomId, roomName, sender, chatApi }) => {
    try {
        // 1. Permitions
        const issue = await jiraRequests.getIssue(roomName);
        const issueMembersChatIds = await Promise.all(
            utils.getIssueMembers(issue).map(displayName => chatApi.getUserIdByDisplayName(displayName)),
        );
        const matrixRoomAdmins = await chatApi.getRoomAdmins({ roomId });
        const admins = [...issueMembersChatIds, ...matrixRoomAdmins.map(({ userId }) => userId)].filter(Boolean);

        const senderUserId = chatApi.getChatUserId(sender);

        if (!admins.includes(senderUserId)) {
            return translate('notAdmin', { sender });
        }
        // 2. Handle all events and archive
        const allEvents = await chatApi.getAllEventsFromRoom(roomId);
        // const allMessages = await chatApi.getAllMessagesFromRoom(roomId);

        // return tmpPath
        const projectKey = utils.getProjectKeyFromIssueKey(roomName);
        const remote = await gitPullToRepo(config.baseRemote, allEvents, projectKey, roomName);

        if (!remote) {
            return translate('gitCommand', { projectKey });
        }

        logger.debug(`Git push successfully complited!!!`);

        // 3. Kick if was flag

        // TODO add removing alias
        if (bodyText && bodyText.includes(KICK_ALL_OPTION)) {
            const members = await chatApi.getRoomMembers({ roomId });
            const membersNotAdmins = Ramda.difference(members, matrixRoomAdmins.map(({ userId }) => userId)).filter(
                Boolean,
            );
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

            return translate('exportWithKick');
        }

        return translate('successExport');
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
    KICK_ALL_OPTION,
};
