import isImage from 'is-image';
import * as fileSystem from 'fs';
import * as path from 'path';
import * as R from 'ramda';
import gitP, { SimpleGit } from 'simple-git/promise';
import * as utils from './utils';
import { fileRequest } from './request';
import { getLogger } from '../modules/log';

const logger = getLogger(module);

const fs = fileSystem.promises;

export const DEFAULT_REMOTE_NAME = 'default';
export const EVENTS_DIR_NAME = 'res';
export const MEDIA_DIR_NAME = 'media';
export const FILE_DELIMETER = '__';
export const DEFAULT_EXT = '.png';
export const VIEW_FILE_NAME = 'README.md';

const getName = (url: string, delim: string): string => R.pipe(R.split(delim), R.last)(url) as string;

export const getMediaFileData = (url, { imageName, msgtype }) => {
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

export const getImageData = (event, api?) => {
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
        const textBody: string | undefined =
            R.path(['content', 'm.new_content', 'body'], event) || R.path(['content', 'body'], event);

        return hasNotCloseQuote(textBody) ? closeQuote(textBody) : textBody;
    }
};

export const getMDtext = events =>
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

export const getRepoLink = (baseLink: string, projectKey = DEFAULT_REMOTE_NAME, roomName?: string): string => {
    const projectExt = projectKey.toLowerCase();
    const args = roomName ? [baseLink, projectExt, 'tree', 'master', roomName] : [baseLink, projectExt];

    return args.join('/');
};

const getGitLink = (sshLink, projectKey = DEFAULT_REMOTE_NAME) =>
    [sshLink, projectKey.toLowerCase()].join('/').concat('.git');

const getResDirName = (projectKey = DEFAULT_REMOTE_NAME, roomName) => `${projectKey.toLowerCase()}/${roomName}`;

// It helps remove all property which dynamically created by the moment of archive
// Instead of it we will get new event each time arhive run
export const transformEvent = event => {
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

        const data: any = await fileRequest(url);
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

export const getRoomMainInfoMd = ({ id, alias, name, topic, members }) => {
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

    // save events, return all events, event which were added before
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
        const repoGit = gitP(repoPath);
        await repoGit.pull('origin', 'master');
        logger.debug(`Remote repo by project key ${repoName} successfully pulled to ${repoPath}`);

        return repoPath;
    }

    const remote = getProjectRemote(baseRemote, repoName);
    const git: SimpleGit = gitP(gitReposPath);
    await git.clone(remote, repoName, ['--depth=3']);
    logger.debug(`clone repo by project key ${repoName} is succedded to tmp dir ${gitReposPath}`);

    return repoPath;
};

export const exportEvents = async ({
    listEvents,
    baseRemote,
    baseLink,
    sshLink,
    gitReposPath,
    roomData,
    chatApi,
    repoName = DEFAULT_REMOTE_NAME,
}) => {
    try {
        const repoPath = await getRepoPath(repoName, { baseRemote, gitReposPath });
        const repoRoomPath = path.resolve(repoPath, roomData.alias);

        const createdFileNames = await writeEventsData(listEvents, repoRoomPath, chatApi, roomData);
        logger.debug(`File creation for ${createdFileNames.length} events is succedded for room ${roomData.alias}!!!`);

        const repoGit: SimpleGit = gitP(repoPath);

        await repoGit.addConfig('user.name', 'bot');
        await repoGit.addConfig('user.email', 'bot@example.com');

        await repoGit.add('./*');
        await repoGit.commit(`set event data for room ${roomData.alias}`);
        await repoGit.push('origin', 'master');

        const httpLink = getRepoLink(baseLink, repoName, roomData.alias);
        const gitLink = getGitLink(sshLink, repoName);
        const dirName = getResDirName(repoName, roomData.alias);

        return { httpLink, gitLink, dirName };
    } catch (err) {
        const msg = utils.errorTracing(`exportEvents ${roomData.alias}`, err);
        logger.error(msg);
    }
};

export const isRepoExists = async (baseRemote, repoName = DEFAULT_REMOTE_NAME) => {
    try {
        const remote = getProjectRemote(baseRemote, repoName);

        const git: SimpleGit = gitP();
        await git.listRemote([remote]);

        return true;
    } catch (error) {
        logger.error(error);

        return false;
    }
};
