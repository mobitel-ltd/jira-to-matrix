import * as R from 'ramda';
import * as utils from '../../../lib/utils';
import { translate } from '../../../locales';
import { getLogger } from '../../../modules/log';
import { setAlias } from '../../settings';
import { exportEvents, isRepoExists, getRepoLink } from '../../../lib/git-lib';
import { EXPECTED_POWER, kickStates, kick, parseBodyText } from './common-actions';

const logger = getLogger(module);
export const KICK_ALL_OPTION = 'kickall';
export const PERSONAL_REPO_OPTION = 'personal';

export const deleteAlias = async (api, alias) => {
    const res = await api.deleteRoomAlias(alias);
    if (!res) {
        logger.warn(`Alias ${alias} is not deleted by bot ${api.getMyId()} and should be saved`);

        await setAlias(alias);
    }
};

export const archive = async ({ bodyText = '', sender, chatApi, roomData, config, taskTracker }) => {
    const { alias, id } = roomData;
    if (!alias) {
        return translate('noAlias');
    }

    const issue = await taskTracker.getIssueSafety(alias);
    const isJiraRoom = await taskTracker.isJiraPartExists(alias);
    if (!issue && isJiraRoom) {
        return translate('issueNotExistOrPermDen');
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

    const textOptions = parseBodyText(bodyText, {
        alias: {
            k: KICK_ALL_OPTION,
            p: PERSONAL_REPO_OPTION,
        },
        boolean: [KICK_ALL_OPTION, PERSONAL_REPO_OPTION],
    });

    if (textOptions.hasUnknown()) {
        return translate('unknownArgs', { unknownArgs: textOptions.unknown });
    }
    const repoName = R.cond([
        [
            R.always(textOptions.has(PERSONAL_REPO_OPTION)),
            // eslint-disable-next-line prettier/prettier
            R.pipe(
                chatApi.getChatUserId.bind(chatApi),
                R.when(R.pathEq([0], '@'), R.drop(1)),
                R.replace(/[^a-z0-9_.-]+/g, '__') as any,
            ),
        ],
        [R.always(isJiraRoom), R.always(utils.getProjectKeyFromIssueKey(alias))],
    ])(sender);

    if (!(await isRepoExists(config.baseRemote, repoName))) {
        const repoLink = getRepoLink(config.baseLink, repoName);

        return translate('repoNotExists', { repoLink });
    }

    const listEvents = await chatApi.getAllEventsFromRoom(id);
    const archivedRoomLinks = await exportEvents({
        listEvents,
        roomData,
        chatApi,
        repoName,
        ...config,
    });
    if (!archivedRoomLinks) {
        return translate('archiveFail', { alias });
    }

    logger.debug(`Git push successfully complited in room ${id}!!!`);

    const successExportMsg = translate('successExport', archivedRoomLinks);
    if (!textOptions.has(KICK_ALL_OPTION)) {
        logger.debug(`Command was made without kick option in room with id ${roomData.id}`);

        return successExportMsg;
    }

    const kickRes = await kick(chatApi, roomData);

    switch (kickRes) {
        case kickStates.NO_POWER: {
            const msg = translate('noBotPower', { power: EXPECTED_POWER });

            return [successExportMsg, msg].join('<br>');
        }
        case kickStates.ALL_KICKED: {
            // all are deleted and no message is needed
            await deleteAlias(chatApi, roomData.alias);
            await chatApi.leaveRoom(roomData.id);
            return;
        }
        case kickStates.ADMINS_EXISTS: {
            const msg = translate('adminsAreNotKicked');
            const sendedMsg = [successExportMsg, msg].join('<br>');
            await chatApi.sendHtmlMessage(roomData.id, sendedMsg, sendedMsg);
            await chatApi.leaveRoom(roomData.id);
        }
    }
};
