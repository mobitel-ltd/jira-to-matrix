/* eslint-disable id-length */
const jiraRequests = require('../../../lib/jira-request');
const utils = require('../../../lib/utils');
const translate = require('../../../locales');
const { EXPECTED_POWER, kickStates, kick, parseBodyText } = require('./common-actions');

const ALL_OPTION = 'all';
const USER_OPTION = 'user';

const kickCoomand = async ({ bodyText, sender, chatApi, roomData, config }) => {
    if (!bodyText) {
        return translate('noOptions');
    }
    const textOptions = parseBodyText(bodyText, {
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

    const issue = await jiraRequests.getIssueSafety(roomData.alias);
    const isJiraRoom = await jiraRequests.isJiraPartExists(roomData.alias);
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

        const res = await kick(chatApi, roomData, chatApi.getChatUserId(userId));
        const resMap = {
            [kickStates.NO_POWER]: translate('noBotPower', { power: EXPECTED_POWER }),
            [kickStates.ALL_KICKED]: translate('userKicked', { userId }),
            [kickStates.FORBIDDEN_KICK_ADMIN]: translate('forbiddenAdminKick', { userId }),
            [kickStates.FORBIDDEN_SELF_KICK]: translate('noSelfKick', { userId }),
            [kickStates.NOT_EXIST]: translate('notFoundUser', { user: userId }),
            [kickStates.ERROR_KICK]: translate('kickFail', { userId }),
        };

        return resMap[res];
    }

    const kickRes = await kick(chatApi, roomData);

    const resMap = {
        [kickStates.NO_POWER]: translate('noBotPower', { power: EXPECTED_POWER }),
        [kickStates.ALL_KICKED]: translate('allKicked'),
        // not care if some users are admin
        [kickStates.ADMINS_EXISTS]: translate('allKicked'),
    };

    return resMap[kickRes];
};

module.exports = {
    kick: kickCoomand,
    ALL_OPTION,
    USER_OPTION,
};
