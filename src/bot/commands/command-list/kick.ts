/* eslint-disable id-length */
import * as utils from '../../../lib/utils';
import { translate } from '../../../locales';
import * as actions from './common-actions';

export const ALL_OPTION = 'all';
export const USER_OPTION = 'user';

export const kick = async ({ bodyText, sender, chatApi, roomData, config, taskTracker }) => {
    if (!bodyText) {
        return translate('noOptions');
    }
    const textOptions = actions.parseBodyText(bodyText, {
        alias: {
            a: ALL_OPTION,
            u: USER_OPTION,
        },
        boolean: [ALL_OPTION],
        string: [USER_OPTION],
    });
    if (textOptions.hasUnknown()) {
        return translate('unknownArgs', { unknownArgs: textOptions.unknown });
    }
    if (textOptions.hasManyOptions()) {
        return translate('oneOptionOnly');
    }
    if (textOptions.has(USER_OPTION) && !textOptions.get(USER_OPTION)) {
        return translate('noOptionArg', { option: USER_OPTION });
    }

    const issue = await taskTracker.getIssueSafety(roomData.alias);
    const isJiraRoom = await taskTracker.isJiraPartExists(roomData.alias);
    if (!issue && isJiraRoom) {
        return translate('issueNotExistOrPermDen');
    }

    const issueCreator = utils.getIssueCreator(issue);
    const issueCreatorChatId = issueCreator && (await chatApi.getUserIdByDisplayName(issueCreator));

    const matrixRoomAdminsId = (await chatApi.getRoomAdmins({ roomId: roomData.id })).map(({ userId }) => userId);
    const admins = [issueCreatorChatId, ...matrixRoomAdminsId].filter(Boolean);

    const senderUserId = chatApi.getChatUserId(sender);

    if (!admins.includes(senderUserId)) {
        return translate('notAdmin', { sender });
    }

    if (textOptions.has(USER_OPTION)) {
        const userId = textOptions.get(USER_OPTION);

        const res = await actions.kick(chatApi, roomData, chatApi.getChatUserId(userId));
        const resMap = {
            [actions.kickStates.NO_POWER]: translate('noBotPower', { power: actions.EXPECTED_POWER }),
            [actions.kickStates.ALL_KICKED]: translate('userKicked', { userId }),
            [actions.kickStates.FORBIDDEN_KICK_ADMIN]: translate('forbiddenAdminKick', { userId }),
            [actions.kickStates.FORBIDDEN_SELF_KICK]: translate('noSelfKick', { userId }),
            [actions.kickStates.NOT_EXIST]: translate('notFoundUser', { user: userId }),
            [actions.kickStates.ERROR_KICK]: translate('kickFail', { userId }),
        };

        return resMap[res];
    }

    const kickRes = await actions.kick(chatApi, roomData);

    const resMap = {
        [actions.kickStates.NO_POWER]: translate('noBotPower', { power: actions.EXPECTED_POWER }),
        [actions.kickStates.ALL_KICKED]: translate('allKicked'),
        // not care if some users are admin
        [actions.kickStates.ADMINS_EXISTS]: translate('allKicked'),
    };

    return resMap[kickRes];
};
