// @ts-check

const isImage = require('is-image');
const fileSystem = require('fs');
const path = require('path');
const R = require('ramda');
const git = require('simple-git/promise');
const jiraRequests = require('../../../lib/jira-request');
const utils = require('../../../lib/utils');
const translate = require('../../../locales');
const logger = require('../../../modules/log.js')(module);
const { fileRequest } = require('../../../lib/request');
const { setAlias } = require('../../settings');

const fs = fileSystem.promises;

const DEFAULT_REMOTE_NAME = 'default';
const EVENTS_DIR_NAME = 'res';
const MEDIA_DIR_NAME = 'media';
const FILE_DELIMETER = '__';
const DEFAULT_EXT = '.png';
const KICK_ALL_OPTION = 'kickall';
const VIEW_FILE_NAME = 'README.md';
const NO_OPTION = 'No option';
const NO_POWER = 'No power';
const ADMINS_EXISTS = 'admins exists';
const ALL_DELETED = 'all deleted';

const EXPECTED_POWER = 100;

const getName = (url, delim) => R.pipe(R.split(delim), R.last)(url);

const getMediaFileData = (url, { imageName, msgtype }) => {
    const imageId = getName(url, '/');

    if (msgtype.includes('avatar')) {
        return {
            imageName,
            fileName: imageId.concat(DEFAULT_EXT),
        };
    }

    if (!imageName) {
        return {
            imageName,
            fileName: imageId,
            skip: true,
        };
    }

    const fileName = [imageId, imageName].join(FILE_DELIMETER);

    if (isImage(imageName)) {
        return { fileName, imageName };
    }

    return { fileName, skip: true, imageName };
};

const getImageData = (event, api) => {
    const chatImageUrl = R.path(['content', 'url'], event);
    if (chatImageUrl) {
        const imageName = R.path(['content', 'body'], event);
        const msgtype = event.type;
        const url = api ? api.getDownloadLink(chatImageUrl) : chatImageUrl;
        const mediaFileData = getMediaFileData(chatImageUrl, { imageName, msgtype });

        return { url, ...mediaFileData };
    }
};

const hasNotCloseQuote = (str = '') => {
    const quoteCount = str.split('```').length - 1;

    return utils.isOdd(quoteCount);
};

const closeQuote = (str = '') => str.concat('\n```');

const getBody = event => {
    const imageData = getImageData(event);
    if (imageData) {
        const filePath = `./${MEDIA_DIR_NAME}/${imageData.fileName}`;
        // replace all spaces to be access in markdown to spaced file names
        const parsedFilePath = filePath.split(' ').join('%20');

        return imageData.skip ? `[${imageData.imageName}](${parsedFilePath})` : `![image](${parsedFilePath})`;
    }

    if (event.content.msgtype === 'm.text') {
        const textBody = R.path(['content', 'm.new_content', 'body'], event) || R.path(['content', 'body'], event);

        return hasNotCloseQuote(textBody) ? closeQuote(textBody) : textBody;
    }
};

const getMDtext = events =>
    events
        .map(item => {
            const author = item.user_id || item.sender;
            const body = getBody(item);
            if (body) {
                const date = new Date(item.origin_server_ts).toJSON();
                const dateWithRelativeLink = `[${date}](./${EVENTS_DIR_NAME}/${item.event_id}.json)`;

                return { author, date: dateWithRelativeLink, body, ts: item.origin_server_ts };
            }

            return false;
        })
        .filter(Boolean)
        .sort((ev1, ev2) => ev2.ts - ev1.ts)
        .map(({ author, date, body }) => [date, author, body].map(el => el.concat('  ')).join('\n'))
        .slice()
        .reverse()
        .join(`\n\n---\n\n`)
        .concat('\n');

// const getHTMLtext = events =>
//     events.map(({ author, date, body }) => [date, author, body].join('<br>')).join(`\n<br><hr>`);

const getProjectRemote = (baseRemote, projectKey) => {
    const projectExt = projectKey.toLowerCase().concat('.git');

    return [baseRemote, projectExt].join('/');
};

const getRepoLink = (baseLink, projectKey, roomName) => {
    const projectExt = projectKey.toLowerCase();

    // to get link visible
    return [baseLink, projectExt, 'tree', 'master', roomName].join('/');
};

// It helps remove all property which dynamically created by the moment of archive
// Instead of it we will get new event each time arhive run
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

const getEventsMediaLinks = (events, chatApi) => events.map(el => getImageData(el, chatApi)).filter(Boolean);

const saveEvent = async (repoRoomResPath, event) => {
    const dataToSave = transformEvent(event);
    const filePath = path.join(repoRoomResPath, `${event.event_id}.json`);
    await fs.writeFile(filePath, dataToSave);

    return filePath;
};

const loadAndSaveMedia = async ({ url, fileName }, dir) => {
    try {
        const mediaFiles = await fs.readdir(dir);
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

const getAllEventsData = async repoRoomResPath => {
    const filesList = await fs.readdir(repoRoomResPath);
    const data = await Promise.all(
        filesList.map(async fileName => {
            const filePath = path.resolve(repoRoomResPath, fileName);
            const fileData = await fs.readFile(filePath, 'utf-8');

            return JSON.parse(fileData);
        }),
    );

    return data;
};

const getRoomMainInfoMd = ({ id, alias, name, topic, members }) => {
    const aliasBlock = `# ${alias}`;
    const nameBlock = ['*', 'room name:', name].join(' ');
    const topicBlock = ['*', 'topic:', topic].join(' ');
    const roomidBlock = ['*', 'roomId:', id].join(' ');
    const membersGroup = members.map(item => `    - ${item.userId}(${item.powerLevel})`).join('\n');

    const membersBlock = ['* members(power level):', membersGroup].join('\n');

    return [aliasBlock, nameBlock, topicBlock, roomidBlock, membersBlock].join('\n');
};

const writeEventsData = async (events, basePath, chatApi, roomData) => {
    const repoRoomResPath = path.resolve(basePath, EVENTS_DIR_NAME);
    if (!fileSystem.existsSync(repoRoomResPath)) {
        await fs.mkdir(repoRoomResPath, { recursive: true });
    }

    // save events, returns all events, event which were added before
    const savedEvents = await Promise.all(events.map(event => saveEvent(repoRoomResPath, event)));

    // render and save view file
    const allEventsRepoData = await getAllEventsData(repoRoomResPath);
    const messagesText = getMDtext(allEventsRepoData);
    const infoDataText = getRoomMainInfoMd(roomData);
    const fullText = [infoDataText, messagesText].join('\n\n');
    await fs.writeFile(path.join(basePath, VIEW_FILE_NAME), fullText);

    // save media
    const eventsMediaLinks = getEventsMediaLinks(events, chatApi);
    const mediaDir = path.resolve(basePath, MEDIA_DIR_NAME);
    if (!fileSystem.existsSync(mediaDir)) {
        await fs.mkdir(mediaDir, { recursive: true });
    }
    await Promise.all(eventsMediaLinks.map(el => loadAndSaveMedia(el, mediaDir)));

    return savedEvents;
};

const getRepoPath = async (repoName, { baseRemote, gitReposPath }) => {
    const repoPath = path.resolve(gitReposPath, repoName);

    if (fileSystem.existsSync(repoPath)) {
        logger.debug(`Remote repo by project key ${repoName} is already exists by path ${repoPath}`);
        const repoGit = git(repoPath);
        await repoGit.pull('origin', 'master');
        logger.debug(`Remote repo by project key ${repoName} successfully pulled to ${repoPath}`);

        return repoPath;
    }

    const remote = getProjectRemote(baseRemote, repoName);
    await git(gitReposPath).clone(remote, repoName, ['--depth=3']);
    logger.debug(`clone repo by project key ${repoName} is succedded to tmp dir ${gitReposPath}`);

    return repoPath;
};

const gitPullToRepo = async (
    { baseRemote, baseLink, gitReposPath },
    listEvents,
    roomData,
    chatApi,
    isRoomJiraProject,
) => {
    try {
        const projectKey = isRoomJiraProject ? utils.getProjectKeyFromIssueKey(roomData.alias) : DEFAULT_REMOTE_NAME;
        const repoPath = await getRepoPath(projectKey, { baseRemote, gitReposPath });
        const repoRoomPath = path.resolve(repoPath, roomData.alias);

        const createdFileNames = await writeEventsData(listEvents, repoRoomPath, chatApi, roomData);
        logger.debug(`File creation for ${createdFileNames.length} events is succedded for room ${roomData.alias}!!!`);

        const repoGit = git(repoPath);

        await repoGit.addConfig('user.name', 'bot');
        await repoGit.addConfig('user.email', 'bot@example.com');

        await repoGit.add('./*');
        await repoGit.commit(`set event data for room ${roomData.alias}`);
        await repoGit.push('origin', 'master');

        const link = getRepoLink(baseLink, projectKey, roomData.alias);

        return link;
    } catch (err) {
        const msg = utils.errorTracing(`gitPullToRepo ${roomData.alias}`, err);
        logger.error(msg);
    }
};

/**
 * @param {{userId: string, powerLevel: number}[]} members room members
 * @param {string} botId bot user Id
 * @returns {{simpleUsers: string[], admins: string[], bot: string[]}} grouped users
 */
const getGroupedUsers = (members, botId) => {
    const getGroup = user => {
        if (user.powerLevel < EXPECTED_POWER) {
            return 'simpleUsers';
        }

        return user.userId.includes(botId) ? 'bot' : 'admins';
    };

    const res = R.pipe(R.groupBy(getGroup), R.map(R.map(R.path(['userId']))))(members);

    return {
        admins: res.admins || [],
        simpleUsers: res.simpleUsers || [],
        bot: res.bot || [],
    };
};

const kickAllInRoom = async (chatApi, roomId, members) => {
    const kickOne = async userId => {
        const res = await chatApi.kickUserByRoom({ roomId, userId });

        return { userId, isKicked: Boolean(res) };
    };

    const groupedData = getGroupedUsers(members, chatApi.getMyId());

    const kickedUsers = await Promise.all(groupedData.simpleUsers.map(kickOne));
    const viewRes = kickedUsers.map(({ userId, isKicked }) => `${userId} ---- ${isKicked}`).join('\n');
    logger.debug(`Result of kicking users from room with id "${roomId}"\n${viewRes}`);

    if (groupedData.admins.length) {
        logger.debug(`Room have admins which bot cannot kick:\n ${groupedData.admins.join('\n')}`);

        return ADMINS_EXISTS;
    }

    return ALL_DELETED;
};

const hasKickOption = bodyText => bodyText && bodyText.includes(KICK_ALL_OPTION);

const hasPowerToKick = (botId, members, expectedPower) => {
    const botData = members.find(user => user.userId.includes(botId));

    return botData && botData.powerLevel === expectedPower;
};

const kick = async (chatApi, bodyText, roomData) => {
    if (!hasKickOption(bodyText)) {
        logger.debug(`Command was made without kick option in room with id ${roomData.id}`);

        return NO_OPTION;
    }

    if (!hasPowerToKick(chatApi.getMyId(), roomData.members, EXPECTED_POWER)) {
        logger.debug(`No power for kick in room with id ${roomData.id}`);

        return NO_POWER;
    }

    const deleteStatus = await kickAllInRoom(chatApi, roomData.id, roomData.members);

    return deleteStatus;
};

const deleteAlias = async (api, alias) => {
    const res = await api.deleteRoomAlias(alias);
    if (!res) {
        logger.warn(`Alias ${alias} is not deleted by bot ${api.getMyId()} and should be saved`);

        await setAlias(alias);
    }
};

const archive = async ({ bodyText, roomId, sender, chatApi, roomData, config }) => {
    const { alias } = roomData;
    if (!alias) {
        return translate('noAlias');
    }

    const issue = await jiraRequests.getIssueSafety(alias);
    const isJiraRoom = await jiraRequests.isJiraPartExists(alias);
    if (!issue && isJiraRoom) {
        return translate('roomNotExistOrPermDen');
    }

    const issueMembersChatIds = await Promise.all(
        utils.getIssueMembers(issue).map(displayName => chatApi.getUserIdByDisplayName(displayName)),
    );
    const matrixRoomAdminsId = (await chatApi.getRoomAdmins({ roomId })).map(({ userId }) => userId);
    const admins = [...issueMembersChatIds, ...matrixRoomAdminsId].filter(Boolean);

    const senderUserId = chatApi.getChatUserId(sender);

    if (!admins.includes(senderUserId)) {
        return translate('notAdmin', { sender });
    }

    const allEvents = await chatApi.getAllEventsFromRoom(roomId);
    const repoLink = await gitPullToRepo(config, allEvents, roomData, chatApi, isJiraRoom);
    if (!repoLink) {
        return translate('archiveFail', { alias });
    }

    logger.debug(`Git push successfully complited in room ${roomId}!!!`);

    const kickRes = await kick(chatApi, bodyText, roomData);

    const successExoprtMsg = translate('successExport', { link: repoLink });

    switch (kickRes) {
        case NO_OPTION: {
            return successExoprtMsg;
        }
        case NO_POWER: {
            const msg = translate('noBotPower', { power: EXPECTED_POWER });

            return [successExoprtMsg, msg].join('<br>');
        }
        case ALL_DELETED: {
            // all are deleted and no message is needed
            await deleteAlias(chatApi, roomData.alias);
            await chatApi.leaveRoom(roomData.id);
            return;
        }
        case ADMINS_EXISTS: {
            const msg = translate('adminsAreNotKicked');
            const sendedMsg = [successExoprtMsg, msg].join('<br>');
            await chatApi.sendHtmlMessage(roomData.id, sendedMsg, sendedMsg);
            await chatApi.leaveRoom(roomData.id);
        }
    }
};

module.exports = {
    deleteAlias,
    DEFAULT_REMOTE_NAME,
    DEFAULT_EXT,
    getMediaFileData,
    archive,
    // getHTMLtext,
    getMDtext,
    gitPullToRepo,
    EVENTS_DIR_NAME,
    KICK_ALL_OPTION,
    VIEW_FILE_NAME,
    MEDIA_DIR_NAME,
    transformEvent,
    getImageData,
    FILE_DELIMETER,
    kickAllInRoom,
    getRoomMainInfoMd,
    getGroupedUsers,
    kick,
};
