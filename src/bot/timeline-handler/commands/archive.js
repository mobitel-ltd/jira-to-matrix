// @ts-check

const R = require('ramda');
const jiraRequests = require('../../../lib/jira-request');
const utils = require('../../../lib/utils');
const translate = require('../../../locales');
const logger = require('../../../modules/log.js')(module);
const { setAlias } = require('../../settings');
const { exportEvents } = require('../../../lib/git-lib');
const { parseBodyText } = require('../../actions/helper');

const KICK_ALL_OPTION = 'kickall';
const CUSTOM_REPO = 'name';
const NO_POWER = 'No power';
const ADMINS_EXISTS = 'admins exists';
const ALL_DELETED = 'all deleted';

const EXPECTED_POWER = 100;

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

const hasPowerToKick = (botId, members, expectedPower) => {
    const botData = members.find(user => user.userId.includes(botId));

    return botData && botData.powerLevel === expectedPower;
};

const kick = async (chatApi, { id, members }, expectedPower = 100) => {
    if (!hasPowerToKick(chatApi.getMyId(), members, expectedPower)) {
        logger.debug(`No power for kick in room with id ${id}`);

        return NO_POWER;
    }

    const groupedData = getGroupedUsers(members, chatApi.getMyId());

    const kickedUsers = await Promise.all(
        groupedData.simpleUsers.map(async userId => {
            const res = await chatApi.kickUserByRoom({ roomId: id, userId });

            return { userId, isKicked: Boolean(res) };
        }),
    );
    const viewRes = kickedUsers.map(({ userId, isKicked }) => `${userId} ---- ${isKicked}`).join('\n');
    logger.debug(`Result of kicking users from room with id "${id}"\n${viewRes}`);

    if (groupedData.admins.length) {
        logger.debug(`Room have admins which bot cannot kick:\n ${groupedData.admins.join('\n')}`);

        return ADMINS_EXISTS;
    }

    return ALL_DELETED;
};

const deleteAlias = async (api, alias) => {
    const res = await api.deleteRoomAlias(alias);
    if (!res) {
        logger.warn(`Alias ${alias} is not deleted by bot ${api.getMyId()} and should be saved`);

        await setAlias(alias);
    }
};

const archive = async ({ bodyText, sender, chatApi, roomData, config }) => {
    const { alias, id } = roomData;
    if (!alias) {
        return translate('noAlias');
    }

    const issue = await jiraRequests.getIssueSafety(alias);
    const isJiraRoom = await jiraRequests.isJiraPartExists(alias);
    if (!issue && isJiraRoom) {
        return translate('roomNotExistOrPermDen');
    }

    const textOptions = parseBodyText(bodyText);
    if (textOptions.has(CUSTOM_REPO) && !textOptions.get(CUSTOM_REPO)) {
        return translate('noOptionArg', { option: CUSTOM_REPO });
    }

    const issueMembersChatIds = await Promise.all(
        utils.getIssueMembers(issue).map(displayName => chatApi.getUserIdByDisplayName(displayName)),
    );
    const matrixRoomAdminsId = (await chatApi.getRoomAdmins({ roomId: id })).map(({ userId }) => userId);
    const admins = [...issueMembersChatIds, ...matrixRoomAdminsId].filter(Boolean);

    const senderUserId = chatApi.getChatUserId(sender);

    if (!admins.includes(senderUserId)) {
        return translate('notAdmin', { sender });
    }

    const listEvents = await chatApi.getAllEventsFromRoom(id);
    const repoName = R.cond([
        [textOptions.has, textOptions.get],
        [() => isJiraRoom, (_, key) => utils.getProjectKeyFromIssueKey(key)],
    ])(CUSTOM_REPO, alias);

    const repoLink = await exportEvents({
        listEvents,
        roomData,
        chatApi,
        repoName,
        baseLink: config.baseLink,
        baseRemote: config.baseRemote,
        gitReposPath: config.gitReposPath,
    });
    if (!repoLink) {
        return translate('archiveFail', { alias });
    }

    logger.debug(`Git push successfully complited in room ${id}!!!`);

    const successExportMsg = translate('successExport', { link: repoLink });
    if (!textOptions.has(KICK_ALL_OPTION)) {
        logger.debug(`Command was made without kick option in room with id ${roomData.id}`);

        return successExportMsg;
    }

    const kickRes = await kick(chatApi, roomData);

    switch (kickRes) {
        case NO_POWER: {
            const msg = translate('noBotPower', { power: EXPECTED_POWER });

            return [successExportMsg, msg].join('<br>');
        }
        case ALL_DELETED: {
            // all are deleted and no message is needed
            await deleteAlias(chatApi, roomData.alias);
            await chatApi.leaveRoom(roomData.id);
            return;
        }
        case ADMINS_EXISTS: {
            const msg = translate('adminsAreNotKicked');
            const sendedMsg = [successExportMsg, msg].join('<br>');
            await chatApi.sendHtmlMessage(roomData.id, sendedMsg, sendedMsg);
            await chatApi.leaveRoom(roomData.id);
        }
    }
};

module.exports = {
    deleteAlias,
    archive,
    // getHTMLtext,
    KICK_ALL_OPTION,
    getGroupedUsers,
    kick,
    CUSTOM_REPO,
};
