const tmp = require('tmp-promise');
const config = require('../../../config');
const fileSystem = require('fs');
const path = require('path');
const git = require('simple-git/promise');
const R = require('ramda');
const jiraRequests = require('../../../lib/jira-request');
const utils = require('../../../lib/utils');
const translate = require('../../../locales');
const logger = require('../../../modules/log.js')(module);
const { fileRequest } = require('../../../lib/request');

const fs = fileSystem.promises;
const EVENTS_DIR_NAME = 'res';
const MEDIA_DIR_NAME = 'media';
const MEDIA_EXTENSION = 'jpg';

const getFileNameByUrl = (url, ext = MEDIA_EXTENSION) =>
    R.pipe(
        R.split('/'),
        R.last,
        R.concat,
    )(url)(`.${ext}`);

const getBody = event => {
    const imageUrl = R.path(['content', 'url'], event);
    if (imageUrl) {
        const imageFileName = getFileNameByUrl(imageUrl);

        return `![image](./${MEDIA_DIR_NAME}/${imageFileName})`;
    }

    return (
        event.content.msgtype === 'm.text' &&
        (R.path(['content', 'm.new_content', 'body'], event) || R.path(['content', 'body'], event))
    );
};

const getMDtext = events =>
    events
        .map(item => {
            const author = item.user_id || item.sender;
            const body = getBody(item);
            if (body) {
                const date = new Date(item.origin_server_ts).toJSON();
                const dateWithRelativeLink = `[${date}](./${EVENTS_DIR_NAME}/${item.event_id}.json)`;

                return { author, date: dateWithRelativeLink, body };
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

const transformEvent = event => {
    // TODO add recursive
    const pureEvent = R.pipe(
        R.dissocPath(['age']),
        R.dissocPath(['unsigned', 'age']),
        R.dissocPath(['unsigned', 'redacted_because', 'age']),
        R.dissocPath(['redacted_because', 'age']),
        R.dissocPath(['redacted_because', 'unsigned', 'age']),
        R.dissocPath(['unsigned', 'redacted_because', 'unsigned', 'age']),
    )(event);

    return JSON.stringify(pureEvent, null, 4).concat('\n');
};

const getEventsMediaLinks = (events, chatApi) =>
    events
        .map(R.path(['content', 'url']))
        .filter(Boolean)
        .map(el => chatApi.getDownloadLink(el));

const saveEvent = async (repoRoomResPath, event) => {
    const dataToSave = transformEvent(event);
    const filePath = path.join(repoRoomResPath, `${event.event_id}.json`);
    await fs.writeFile(filePath, dataToSave);

    return filePath;
};

const loadAndSaveMedia = async (url, dir) => {
    try {
        const mediaFiles = await fs.readdir(dir);
        const fileName = getFileNameByUrl(url);
        if (mediaFiles.includes(fileName)) {
            logger.debug(`Media file with name ${fileName} is already exists`);

            return fileName;
        }

        const data = await fileRequest(url);
        const pathToFile = path.resolve(dir, fileName);
        await fs.writeFile(pathToFile, data);
        logger.debug(`Media file with name ${fileName} is saved!!!`);

        return fileName;
    } catch (error) {
        logger.error(`Error in loading file \n${JSON.stringify(error)}`);
    }
};

const writeEventsData = async (events, basePath, chatApi) => {
    const repoRoomResPath = path.resolve(basePath, EVENTS_DIR_NAME);
    if (!fileSystem.existsSync(repoRoomResPath)) {
        await fs.mkdir(repoRoomResPath, { recursive: true });
    }

    // render and save view file
    const renderedText = getMDtext(events);
    await fs.writeFile(path.join(basePath, VIEW_FILE_NAME), renderedText);

    // save media
    const eventsMediaLinks = getEventsMediaLinks(events, chatApi);
    const mediaDir = path.resolve(basePath, MEDIA_DIR_NAME);
    if (!fileSystem.existsSync(mediaDir)) {
        await fs.mkdir(mediaDir, { recursive: true });
    }
    await Promise.all(eventsMediaLinks.map(el => loadAndSaveMedia(el, mediaDir)));

    return Promise.all(events.map(event => saveEvent(repoRoomResPath, event)));
};

const gitPullToRepo = async (baseRemote, listEvents, roomName, chatApi) => {
    const { path: tmpPath, cleanup } = await tmp.dir({ unsafeCleanup: true });
    try {
        const projectKey = utils.getProjectKeyFromIssueKey(roomName);
        const remote = getProjectRemote(baseRemote, projectKey);
        await git(tmpPath).clone(remote, projectKey);
        logger.debug(`clone repo by project key ${projectKey} is succedded to tmp dir ${tmpPath}`);
        const repoPath = path.resolve(tmpPath, projectKey);
        const repoRoomPath = path.resolve(repoPath, roomName);

        const createdFileNames = await writeEventsData(listEvents, repoRoomPath, chatApi);
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
        const remote = await gitPullToRepo(config.baseRemote, allEvents, roomName, chatApi);

        if (!remote) {
            return translate('gitCommand', { roomName });
        }

        logger.debug(`Git push successfully complited!!!`);

        // 3. Kick if was flag

        // TODO add removing alias
        if (bodyText && bodyText.includes(KICK_ALL_OPTION)) {
            const members = await chatApi.getRoomMembers({ roomId });
            const membersNotAdmins = R.difference(members, matrixRoomAdmins.map(({ userId }) => userId)).filter(
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
    getFileNameByUrl,
    archive,
    getHTMLtext,
    getMDtext,
    gitPullToRepo,
    EVENTS_DIR_NAME,
    KICK_ALL_OPTION,
    VIEW_FILE_NAME,
    MEDIA_DIR_NAME,
    MEDIA_EXTENSION,
    transformEvent,
};
