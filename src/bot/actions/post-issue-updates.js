const utils = require('../../lib/utils');
const logger = require('../../modules/log.js')(module);
const { getIssueUpdateInfoMessageBody, getNewAvatarUrl } = require('./helper.js');
const R = require('ramda');
const { exportEvents, isRepoExists, getRepoLink } = require('../../lib/git-lib');
const { kick } = require('../commands/command-list/common-actions');
const translate = require('../../locales');
const jiraRequests = require('../../lib/jira-request');

const isArchiveStatus = async (exportConfigParams, projectKey, statusId) => {
    if (!statusId) {
        logger.debug('Status is not changed');

        return false;
    }

    const isInConfigArchiveList = R.pipe(
        R.pathOr([], ['options', 'lastIssue']),
        R.includes(projectKey),
    )(exportConfigParams);

    if (isInConfigArchiveList) {
        const { colorName } = await jiraRequests.getStatusData(statusId);

        return colorName === utils.LAST_STATUS_COLOR;
    }

    return false;
};

/**
 * post issue update
 * @param  {object} options options
 * @param  {object} options.chatApi messenger client instance
 * @param  {string} options.oldKey old key of issue
 * @param  {string} [options.newKey] new key of issue
 * @param  {{key: string, summary: string}} [options.newNameData] new name of room
 * @param  {object} options.changelog changes object\
 * @param  {string} options.author changes author
 * @param  {string} [options.newStatusId] new status id for issue
 * @param  {object} options.config config data
 */
const postIssueUpdates = async ({ chatApi, newStatusId, config, ...body }) => {
    try {
        if (!(await jiraRequests.hasIssue(body.oldKey))) {
            logger.warn(`Issue by key ${body.oldKey} is not exists`);

            return false;
        }

        const roomId = await chatApi.getRoomId(body.oldKey);

        if (body.newKey) {
            const topic = utils.getViewUrl(body.newKey);
            await chatApi.updateRoomData(roomId, topic, body.newKey);
            logger.debug(`Added new topic ${body.newKey} for room ${body.oldKey}`);
        }

        if (body.newNameData) {
            await chatApi.updateRoomName(roomId, body.newNameData);
            logger.debug(`Room ${body.oldKey} name updated with ${body.newNameData.summary}`);
        }

        const info = await getIssueUpdateInfoMessageBody(body);
        await chatApi.sendHtmlMessage(roomId, info.body, info.htmlBody);
        logger.debug(`Posted updates to ${roomId}`);

        const newAvatarUrl = await getNewAvatarUrl(body.oldKey, {
            statusId: newStatusId,
            colors: R.path(['colors', 'links'], config),
            usingPojects: R.path(['colors', 'projects'], config),
        });

        if (newAvatarUrl) {
            await chatApi.setRoomAvatar(roomId, newAvatarUrl);

            logger.debug(`Room ${roomId} have got new avatar ${newAvatarUrl}`);
        }

        const projectKey = utils.getProjectKeyFromIssueKey(body.oldKey);
        if (await isArchiveStatus(config.gitArchive, projectKey, newStatusId)) {
            const repoName = projectKey;

            if (!(await isRepoExists(config.baseRemote, repoName))) {
                const repoLink = getRepoLink(config.baseLink, projectKey);

                logger.warn(translate('repoNotExists', { repoLink }));

                return true;
            }

            const listEvents = await chatApi.getAllEventsFromRoom(roomId);
            const { roomData, client } = await chatApi.getRoomAndClient(roomId);
            const archivedRoomLink = await exportEvents({
                listEvents,
                roomData,
                client,
                repoName,
                baseLink: config.baseLink,
                baseRemote: config.baseRemote,
                gitReposPath: config.gitReposPath,
            });
            if (!archivedRoomLink) {
                logger.debug(translate('archiveFail', { alias: roomData.alias }));

                return true;
            }

            logger.debug(`Git push successfully complited in room ${roomId}!!!`);

            const kickRes = await kick(client, roomData);

            logger.debug(`Result of kicking in room ${roomData.alias} is ${kickRes}`);
        }

        return true;
    } catch (err) {
        logger.error(err);
        throw utils.errorTracing('postIssueUpdates', err);
    }
};

module.exports = {
    postIssueUpdates,
    isArchiveStatus,
};
