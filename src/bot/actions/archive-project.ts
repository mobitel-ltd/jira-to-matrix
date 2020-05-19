import * as delay from 'delay';
import * as R from 'ramda';
import { getLogger } from '../../modules/log';
import * as utils from '../../lib/utils';
import { kick } from '../commands/command-list/common-actions';
import { exportEvents } from '../../lib/git-lib';
import { MessengerApi } from '../../types';

const logger = getLogger(module);

export enum stateEnum {
    // rooms which have messages which sent after keeping date
    STILL_ACTIVE = 'still active',
    // room is archived, all users kicked and alias deleted
    ARCHIVED = 'successfully archived and kicked',
    // room not found by alias, it has bben removed before or never been created
    NOT_FOUND = 'alias is not found',
    // room has no one bot but it was made and left before, alias of this room is removed
    ALIAS_REMOVED = 'alias removed in left room',
    // alias and roomid exists but bots has no power to delete it, maybe it was made by test bot
    OTHER_ALIAS_CREATOR = 'other alias creator',
    // error archiving
    ERROR_ARCHIVING = 'error archiving',
    // some problem during getting events, archive stop
    FORBIDDEN_EVENTS = 'cannot get events',
    // room alias is changed, it means that issue has been moved to another project
    MOVED = 'issue moved to another project',
    // room alias is not received by room meta data and we can't do any action with it
    ROOM_NOT_RETURN_ALIAS = 'no alias from room meta',
    // issue status is not equals to status which was in args
    ANOTHER_STATUS = 'issue is in another status',
}

const getAccum = (): Record<stateEnum, string[]> => ({
    [stateEnum.STILL_ACTIVE]: [],
    [stateEnum.ARCHIVED]: [],
    [stateEnum.NOT_FOUND]: [],
    [stateEnum.ALIAS_REMOVED]: [],
    [stateEnum.OTHER_ALIAS_CREATOR]: [],
    [stateEnum.ERROR_ARCHIVING]: [],
    [stateEnum.FORBIDDEN_EVENTS]: [],
    [stateEnum.MOVED]: [],
    [stateEnum.ROOM_NOT_RETURN_ALIAS]: [],
    [stateEnum.ANOTHER_STATUS]: [],
});

const isMessage = item => item.type === 'm.room.message';
export const getLastMessageTimestamp = events =>
    events
        .filter(isMessage)
        .map(item => item.origin_server_ts)
        .reduce((acc, val) => (acc > val ? acc : val), 0);

export const archiveAndForget = async ({ client, roomData, keepTimestamp, config }) => {
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
        const repoLinks = await exportEvents({
            listEvents: allEvents,
            chatApi: client,
            roomData,
            repoName: utils.getProjectKeyFromIssueKey(roomData.alias),
            ...config,
        });
        if (!repoLinks) {
            logger.error(`Some fail has happen after attempt to archive room with alias ${roomData.alias}`);

            return stateEnum.ERROR_ARCHIVING;
        }

        logger.info(`Room "${roomData.alias}" with id ${roomData.id} is archived to ${repoLinks.httpLink}`);

        await kick(client, roomData);
        await client.leaveRoom(roomData.id);

        return stateEnum.ARCHIVED;
    } catch (error) {
        logger.error(utils.errorTracing(`archiving room ${roomData.alias}`, error));

        return stateEnum.ERROR_ARCHIVING;
    }
};

export const deleteByEachBot = async (fasadeApi, alias) => {
    const allBotsClients = fasadeApi.getAllInstance();
    const res = await Promise.all(allBotsClients.map(api => api.deleteRoomAlias(alias)));
    if (res.some(Boolean)) {
        logger.info(`Alias "${alias}" is deleted`);

        return stateEnum.ALIAS_REMOVED;
    }
    logger.warn(`No bot has made alias "${alias}"`);

    return stateEnum.OTHER_ALIAS_CREATOR;
};

export const handleKnownRoom = async (chatApi, { keepTimestamp, roomId, alias, status, config, taskTracker }) => {
    const data = await chatApi.getRoomAndClient(roomId);
    if (!data) {
        logger.debug(`No bot can get room meta by alias ${alias} they are not joined. Try remove it.`);

        return deleteByEachBot(chatApi, alias);
    }

    if (status) {
        const issueCurrentStatus = await taskTracker.getCurrentStatus(alias);
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

export const getRoomArchiveState = async (chatApi, { alias, keepTimestamp, status, config, taskTracker }) => {
    const roomId = await chatApi.getRoomIdByName(alias);

    return roomId
        ? handleKnownRoom(chatApi, { keepTimestamp, roomId, alias, status, config, taskTracker })
        : stateEnum.NOT_FOUND;
};

const runArchive = (
    chatApi: MessengerApi,
    { projectKey, lastNumber, keepTimestamp, status, config, taskTracker },
): Promise<Record<stateEnum, string[]>> => {
    const iter = async (num: number, accum: Record<stateEnum, string[]>): Promise<Record<stateEnum, string[]>> => {
        if (num === 0) {
            logger.info(`All project "${projectKey}" rooms are handled`);

            return accum;
        }

        // make delay to avoid overload matrix server
        await delay(config.delayInterval);
        const alias = [projectKey, num].join('-');
        const startTime = Date.now();

        const state = await getRoomArchiveState(chatApi, {
            status,
            keepTimestamp,
            alias,
            config,
            taskTracker,
        });
        const { min, sec } = utils.timing(startTime);
        logger.info(`Room with alias ${alias} archiving try time: ${min} min ${sec} sec`);

        accum[state].push(alias);

        return iter(num - 1, accum);
    };

    return iter(lastNumber, getAccum());
};

export const archiveProject = async ({ chatApi, projectKey, keepTimestamp, status, config, taskTracker }) => {
    try {
        logger.info('Start archiving project');
        const lastIssueKey = await taskTracker.getLastIssueKey(projectKey);
        if (lastIssueKey) {
            const lastNumber = R.pipe(R.split('-'), R.last, parseInt)(lastIssueKey);

            const res = await runArchive(chatApi, {
                projectKey,
                lastNumber,
                keepTimestamp: Number(keepTimestamp),
                status,
                config,
                taskTracker,
            });

            const commandRoom = chatApi.getCommandRoomName();
            if (commandRoom) {
                const commandRoomId = await chatApi.getRoomIdByName(commandRoom);
                const preparedMsg =
                    res &&
                    Object.entries(res)
                        .map(([key, val]) => `${key} >>> ${val.length ? val : 'none'}`)
                        .join('<br>');
                await chatApi.sendHtmlMessage(commandRoomId, preparedMsg);
            }

            return res;
        }

        logger.warn(`No issue key is found in project ${projectKey}. Skip archiving`);

        return false;
    } catch (err) {
        logger.error(err);
        throw utils.errorTracing('archiveProject', err);
    }
};
