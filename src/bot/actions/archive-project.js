// @ts-check

const delay = require('delay');
const R = require('ramda');
const config = require('../../config');
const logger = require('../../modules/log.js')(module);
const { errorTracing } = require('../../lib/utils.js');
const { getLastIssueKey } = require('../../lib/jira-request.js');
const { kickAllInRoom, gitPullToRepo } = require('../timeline-handler/commands/archive');

const STILL_ACTIVE = 'still active';
const ARCHIVED = 'successfully archived and kicked';
const NOT_FOUND = 'alias is not found';
const ALIAS_REMOVED = 'alias removed';
const OTHER_ALIAS_CREATOR = 'other alias creator';
const ERROR_ARCHIVING = 'error archiving';
const FORBIDDEN_EVENTS = 'cannot get events';

const isMessage = item => item.type === 'm.room.message';
const getLastMessageTimestamp = events =>
    events
        .filter(isMessage)
        .map(item => item.origin_server_ts)
        .reduce((acc, val) => (acc > val ? acc : val), 0);

const archiveAndForget = async ({ client, roomData, keepTimestamp }) => {
    try {
        const allEvents = await client.getAllEventsFromRoom(roomData.id);
        if (!allEvents) {
            return FORBIDDEN_EVENTS;
        }
        const lastMessageTimestamp = getLastMessageTimestamp(allEvents);
        logger.debug(
            `Last message was made -- ${new Date(lastMessageTimestamp)}, keeping date --${new Date(keepTimestamp)}`,
        );
        if (lastMessageTimestamp > keepTimestamp) {
            logger.debug(`${roomData.alias} is still active, skip archive`);

            return STILL_ACTIVE;
        }
        const repoLink = await gitPullToRepo(config, allEvents, roomData, client, true);
        if (!repoLink) {
            return ERROR_ARCHIVING;
        }

        logger.info(`Room "${roomData.alias}" with id ${roomData.id} is archived to ${repoLink}`);

        await kickAllInRoom(client, roomData.id, roomData.members);
        await client.deleteRoomAlias(roomData.alias);
        await client.leaveRoom(roomData.id);

        return ARCHIVED;
    } catch (error) {
        logger.error(errorTracing(`archiving room ${roomData.alias}`, error));

        return ERROR_ARCHIVING;
    }
};

const deleteByEachBot = async (fasadeApi, alias) => {
    const allBotsClients = fasadeApi.getAllInstance();
    const res = await Promise.all(allBotsClients.map(api => api.deleteRoomAlias(alias)));
    if (res.some(Boolean)) {
        logger.info(`Alias "${alias}" is deleted`);

        return ALIAS_REMOVED;
    }
    logger.warn(`No bot has made alias "${alias}"`);

    return OTHER_ALIAS_CREATOR;
};

const runArchive = (chatApi, { projectKey, lastNumber, keepTimestamp }) => {
    const accumBase = {
        // some problem during getting events, archive stop
        [FORBIDDEN_EVENTS]: [],
        // rooms which have messages which sent after keeping date
        [STILL_ACTIVE]: [],
        // room is archived, all users kicked and alias deleted
        [ARCHIVED]: [],
        // room not found by alias, it has bben removed before or never been created
        [NOT_FOUND]: [],
        // room has no one bot but it was made and left before, alias of this room is removed
        [ALIAS_REMOVED]: [],
        // alias and roomid exists but bots has no power to delete it, maybe it was made by test bot
        [OTHER_ALIAS_CREATOR]: [],
        // error archiving
        [ERROR_ARCHIVING]: [],
    };

    const handleKnownRoom = async (roomId, alias) => {
        const data = await chatApi.getRoomAndClient(roomId);

        return data ? archiveAndForget({ ...data, keepTimestamp }) : deleteByEachBot(chatApi, alias);
    };

    const iter = async (num, accum) => {
        if (num === 0) {
            logger.info(`All project "${projectKey}" rooms are handled`);

            return accum;
        }

        // make delay to avoid overload matrix server
        await delay(config.delayInterval);

        const alias = [projectKey, num].join('-');
        const roomId = await chatApi.getRoomIdByName(alias);
        const status = roomId ? await handleKnownRoom(roomId, alias) : NOT_FOUND;
        accum[status].push(alias);

        return iter(num - 1, accum);
    };

    return iter(lastNumber, accumBase);
};

const archiveProject = async ({ chatApi, projectKey, keepTimestamp }) => {
    try {
        logger.info('Start archiving project');
        const lastIssueKey = await getLastIssueKey(projectKey);
        if (lastIssueKey) {
            const lastNumber = R.pipe(R.split('-'), R.last, parseInt)(lastIssueKey);

            const res = await runArchive(chatApi, { projectKey, lastNumber, keepTimestamp });

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
    } catch (err) {
        throw errorTracing('archiveProject', err);
    }
};

module.exports = {
    archiveAndForget,
    archiveProject,
    deleteByEachBot,
    ARCHIVED,
    NOT_FOUND,
    ALIAS_REMOVED,
    OTHER_ALIAS_CREATOR,
    ERROR_ARCHIVING,
    STILL_ACTIVE,
    getLastMessageTimestamp,
};
