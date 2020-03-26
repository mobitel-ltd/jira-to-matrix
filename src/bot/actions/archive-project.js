const R = require('ramda');
const config = require('../../config');
const logger = require('../../modules/log.js')(module);
const { errorTracing } = require('../../lib/utils.js');
const { getLastIssueKey } = require('../../lib/jira-request.js');
const { kickAllInRoom, gitPullToRepo } = require('../timeline-handler/commands/archive');

const ARCHIVED = 'successfully archived and kicked';
const NOT_FOUND = 'not found';
const ALIAS_REMOVED = 'alias removed';
const OTHER_ALIAS_CREATOR = 'other alias creator';
const ERROR_ARCHIVING = 'error archiving';

const archiveAndForget = async ({ client, roomData }) => {
    try {
        const allEvents = await client.getAllEventsFromRoom(roomData.id);
        const repoLink = await gitPullToRepo(config, allEvents, roomData, client, true);
        logger.info(`Room "${roomData.alias}" with id ${roomData.id} is archived to ${repoLink}`);

        await kickAllInRoom(client, roomData.id, roomData.members);
        await client.deleteAlias(roomData.alias);
        await client.leaveRoom(roomData.id);

        return ARCHIVED;
    } catch (error) {
        logger.error(errorTracing(`Error in archiving room ${roomData.alias}`, error));

        return ERROR_ARCHIVING;
    }
};

const deleteByEachBot = async (fasadeApi, alias) => {
    const allBotsClients = fasadeApi.getAllInstance();
    const res = await Promise.all(allBotsClients.map(api => api.deleteAlias(alias)));
    if (res.some(Boolean)) {
        logger.info(`Alias "${alias}" is deleted`);

        return ALIAS_REMOVED;
    }
    logger.warn(`No bot has made alias "${alias}"`);

    return OTHER_ALIAS_CREATOR;
};

const accumBase = {
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

const runArchive = (chatApi, projectKey, lastNumber) => {
    const iter = async (num, accum) => {
        if (num === 0) {
            logger.info(`All project "${projectKey}" rooms are handled`);

            return accum;
        }

        const alias = [projectKey, num].join('-');
        const roomId = await chatApi.getRoomIdByName(alias);
        if (roomId) {
            const data = await chatApi.getRoomAndClient(roomId);
            const res = data ? await archiveAndForget(data) : await deleteByEachBot(chatApi, alias);

            accum[res].push(alias);
        } else {
            accum[NOT_FOUND].push(alias);
        }

        return iter(num - 1, accum);
    };

    return iter(lastNumber, accumBase);
};

const archiveProject = async ({ chatApi, projectKey }) => {
    try {
        logger.info('Start archiving project');
        const lastIssueKey = await getLastIssueKey(projectKey);
        if (lastIssueKey) {
            const issueNumber = R.pipe(R.split('-'), R.last, parseInt)(lastIssueKey);

            const res = await runArchive(chatApi, projectKey, issueNumber);

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
    accumBase,
    ARCHIVED,
    NOT_FOUND,
    ALIAS_REMOVED,
    OTHER_ALIAS_CREATOR,
    ERROR_ARCHIVING,
};
