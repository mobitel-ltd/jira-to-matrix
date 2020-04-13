// @ts-check

const delay = require('delay');
const R = require('ramda');
const logger = require('../../modules/log.js')(module);
const { errorTracing } = require('../../lib/utils.js');
const { getLastIssueKey } = require('../../lib/jira-request.js');
const { kick } = require('../commands/command-list/common-actions');
const { exportEvents } = require('../../lib/git-lib');
const jiraRequests = require('../../lib/jira-request');
const utils = require('../../lib/utils');

const stateEnum = {
    // rooms which have messages which sent after keeping date
    STILL_ACTIVE: 'still active',
    // room is archived, all users kicked and alias deleted
    ARCHIVED: 'successfully archived and kicked',
    // room not found by alias, it has bben removed before or never been created
    NOT_FOUND: 'alias is not found',
    // room has no one bot but it was made and left before, alias of this room is removed
    ALIAS_REMOVED: 'alias removed in left room',
    // alias and roomid exists but bots has no power to delete it, maybe it was made by test bot
    OTHER_ALIAS_CREATOR: 'other alias creator',
    // error archiving
    ERROR_ARCHIVING: 'error archiving',
    // some problem during getting events, archive stop
    FORBIDDEN_EVENTS: 'cannot get events',
    // room alias is changed, it means that issue has been moved to another project
    MOVED: 'issue moved to another project',
    // room alias is not received by room meta data and we can't do any action with it
    ROOM_NOT_RETURN_ALIAS: 'no alias from room meta',
    // issue status is not equals to status which was in args
    ANOTHER_STATUS: 'issue is in another status',
};

const getAccum = () => Object.values(stateEnum).reduce((acc, val) => ({ ...acc, [val]: [] }), {});

const isMessage = item => item.type === 'm.room.message';
const getLastMessageTimestamp = events =>
    events
        .filter(isMessage)
        .map(item => item.origin_server_ts)
        .reduce((acc, val) => (acc > val ? acc : val), 0);

const archiveAndForget = async ({ client, roomData, keepTimestamp, config }) => {
    try {
        const allEvents = await client.getAllEventsFromRoom(roomData.id);
        if (!allEvents) {
            return stateEnum.FORBIDDEN_EVENTS;
        }
        const lastMessageTimestamp = getLastMessageTimestamp(allEvents);
        logger.debug(
            `Last message was made -- ${new Date(lastMessageTimestamp)}, keeping date --${new Date(keepTimestamp)}`,
        );
        if (lastMessageTimestamp > keepTimestamp) {
            logger.debug(`${roomData.alias} is still active, skip archive`);

            return stateEnum.STILL_ACTIVE;
        }
        const repoLink = await exportEvents({
            listEvents: allEvents,
            baseLink: config.baseLink,
            baseRemote: config.baseRemote,
            chatApi: client,
            roomData,
            gitReposPath: config.gitReposPath,
            repoName: utils.getProjectKeyFromIssueKey(roomData.alias),
        });
        if (!repoLink) {
            logger.error(`Some fail has happen after attempt to archive room with alias ${roomData.alias}`);

            return stateEnum.ERROR_ARCHIVING;
        }

        logger.info(`Room "${roomData.alias}" with id ${roomData.id} is archived to ${repoLink}`);

        await kick(client, roomData);
        await client.leaveRoom(roomData.id);

        return stateEnum.ARCHIVED;
    } catch (error) {
        logger.error(errorTracing(`archiving room ${roomData.alias}`, error));

        return stateEnum.ERROR_ARCHIVING;
    }
};

const deleteByEachBot = async (fasadeApi, alias) => {
    const allBotsClients = fasadeApi.getAllInstance();
    const res = await Promise.all(allBotsClients.map(api => api.deleteRoomAlias(alias)));
    if (res.some(Boolean)) {
        logger.info(`Alias "${alias}" is deleted`);

        return stateEnum.ALIAS_REMOVED;
    }
    logger.warn(`No bot has made alias "${alias}"`);

    return stateEnum.OTHER_ALIAS_CREATOR;
};

const handleKnownRoom = async (chatApi, { keepTimestamp, roomId, alias, status, config }) => {
    const data = await chatApi.getRoomAndClient(roomId);
    if (!data) {
        logger.debug(`No bot can get room meta by alias ${alias} they are not joined. Try remove it.`);

        return deleteByEachBot(chatApi, alias);
    }

    if (status) {
        const issueCurrentStatus = await jiraRequests.getCurrentStatus(alias);
        if (issueCurrentStatus && issueCurrentStatus !== status) {
            logger.warn(
                `Issue with key ${alias} has status "${issueCurrentStatus}". Expected is "${status}". Skip archiving`,
            );

            return stateEnum.ANOTHER_STATUS;
        }
    }

    const currentMainAlias = data.roomData.alias;
    if (!currentMainAlias) {
        logger.warn(`Room with id ${roomId} cannot return current alias. It has been found by alias ${alias}.`);

        return stateEnum.ROOM_NOT_RETURN_ALIAS;
    }

    // the last room alias is new
    if (data.roomData.alias !== alias) {
        logger.warn(`Room with id ${roomId} has moved alias from  ${alias} to ${data.roomData.alias}`);
        await deleteByEachBot(chatApi, alias);

        return stateEnum.MOVED;
    }

    const state = await archiveAndForget({ ...data, keepTimestamp, config });
    if (state === stateEnum.ARCHIVED) {
        await deleteByEachBot(chatApi, alias);
    }

    return state;
};

const getRoomArchiveState = async (chatApi, { projectKey, alias, keepTimestamp, status, config }) => {
    const roomId = await chatApi.getRoomIdByName(alias);

    return roomId ? handleKnownRoom(chatApi, { keepTimestamp, roomId, alias, status, config }) : stateEnum.NOT_FOUND;
};

const runArchive = (chatApi, { projectKey, lastNumber, keepTimestamp, status, config }) => {
    const iter = async (num, accum) => {
        if (num === 0) {
            logger.info(`All project "${projectKey}" rooms are handled`);

            return accum;
        }

        // make delay to avoid overload matrix server
        await delay(config.delayInterval);
        const alias = [projectKey, num].join('-');
        const startTime = Date.now();

        const state = await getRoomArchiveState(chatApi, { projectKey, status, keepTimestamp, alias, config });
        const { min, sec } = utils.timing(startTime);
        logger.info(`Room with alias ${alias} archiving try time: ${min} min ${sec} sec`);

        accum[state].push(alias);

        return iter(num - 1, accum);
    };

    return iter(lastNumber, getAccum());
};

const archiveProject = async ({ chatApi, projectKey, keepTimestamp, status, config }) => {
    try {
        logger.info('Start archiving project');
        const lastIssueKey = await getLastIssueKey(projectKey);
        if (lastIssueKey) {
            const lastNumber = R.pipe(R.split('-'), R.last, parseInt)(lastIssueKey);

            const res = await runArchive(chatApi, {
                projectKey,
                lastNumber,
                keepTimestamp: Number(keepTimestamp),
                status,
                config,
            });

            const commandRoom = chatApi.getCommandRoomName();
            if (commandRoom) {
                const commandRoomId = await chatApi.getRoomIdByName(commandRoom);
                const preparedMsg =
                    res &&
                    Object.entries(res)
                        .map(([k, v]) => `${k} >>> ${v.length ? v : 'none'}`)
                        .join('<br>');
                await chatApi.sendHtmlMessage(commandRoomId, preparedMsg);
            }

            return res;
        }

        logger.warn(`No issue key is found in project ${projectKey}. Skip archiving`);

        return false;
    } catch (err) {
        logger.error(err);
        throw errorTracing('archiveProject', err);
    }
};

module.exports = {
    handleKnownRoom,
    archiveAndForget,
    archiveProject,
    deleteByEachBot,
    stateEnum,
    getLastMessageTimestamp,
    getRoomArchiveState,
};
