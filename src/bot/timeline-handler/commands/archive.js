const tmp = require('tmp-promise');
const config = require('../../../config');
const fileSystem = require('fs');
const path = require('path');
const git = require('simple-git/promise');
const Ramda = require('ramda');
const jiraRequests = require('../../../lib/jira-request');
const utils = require('../../../lib/utils');
const translate = require('../../../locales');
const logger = require('../../../modules/log.js')(module);

const fs = fileSystem.promises;
const EVENTS_DIR_NAME = 'res';

const getMDtext = events =>
    events
        .map(item => {
            const author = item.user_id || item.sender;
            const body =
                item.content.msgtype === 'm.text' &&
                (Ramda.path(['content', 'm.new_content', 'body'], item) || Ramda.path(['content', 'body'], item));
            const date = new Date(item.origin_server_ts).toJSON();
            const dateWithRelativeLink = `[${date}](./${EVENTS_DIR_NAME}/${item.event_id}.json)`;
            const eventId = item.event_id;
            if (body) {
                return { author, date: dateWithRelativeLink, body, eventId };
            }

            return false;
        })
        .filter(Boolean)
        .map(({ author, date, body }) => [date, author, body].map(el => `${el}  `).join('\n'))
        .slice()
        .reverse()
        .join(`\n\n---\n\n`)
        .concat('\n');

const getHTMLtext = events =>
    events.map(({ author, date, body }) => [date, author, body].join('<br>')).join(`\n<br><hr>`);

const KICK_ALL_OPTION = 'kickall';

const VIEW_FILE_NAME = 'view.md';

const getProjectRemote = (baseRemote, projectKey) => {
    const projectExt = `${projectKey.toLowerCase()}.git`;

    return [baseRemote, projectExt].join('/');
};

const transformEvent = event => JSON.stringify(event, null, 2).concat('\n');

const writeOneEvent = async (repoRoomResPath, event) => {
    const dataToSave = transformEvent(event);
    const filePath = path.join(repoRoomResPath, `${event.event_id}.json`);
    await fs.writeFile(filePath, dataToSave);

    return filePath;
};

const writeEventsData = async (events, basePath) => {
    const repoRoomResPath = path.resolve(basePath, EVENTS_DIR_NAME);
    if (!fileSystem.existsSync(repoRoomResPath)) {
        await fs.mkdir(repoRoomResPath, { recursive: true });
    }
    const renderedText = getMDtext(events);
    await fs.writeFile(path.join(basePath, VIEW_FILE_NAME), renderedText);

    return Promise.all(events.map(event => writeOneEvent(repoRoomResPath, event)));
};

const gitPullToRepo = async (baseRemote, listEvents, roomName) => {
    const { path: tmpPath, cleanup } = await tmp.dir({ unsafeCleanup: true });
    try {
        const projectKey = utils.getProjectKeyFromIssueKey(roomName);
        const remote = getProjectRemote(baseRemote, projectKey);
        await git(tmpPath).clone(remote, projectKey);
        logger.debug(`clone repo by project key ${projectKey} is succedded to tmp dir ${tmpPath}`);
        const repoPath = path.resolve(tmpPath, projectKey);
        const repoRoomPath = path.resolve(repoPath, roomName);

        const createdFileNames = await writeEventsData(listEvents, repoRoomPath);
        logger.debug(`File creation for ${createdFileNames.length} events is succedded for room name ${roomName}!!!`);

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
        const remote = await gitPullToRepo(config.baseRemote, allEvents, roomName);

        if (!remote) {
            return translate('gitCommand', { roomName });
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
    VIEW_FILE_NAME,
};
