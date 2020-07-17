/* eslint-disable id-length */
import { translate } from '../../../locales';
import * as actions from './common-actions';
import { Command, RunCommand } from './command-base';
import { CommandOptions } from '../../../types';
import { Jira } from '../../../task-trackers/jira';

export const ALL_OPTION = 'all';
export const USER_OPTION = 'user';

export class KickCommand extends Command<Jira> implements RunCommand {
    async run({ bodyText, sender, roomData }: CommandOptions) {
        if (!roomData.alias) {
            throw new Error('Not issue room');
        }

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

        const issue = await this.taskTracker.getIssueSafety(roomData.alias);
        const isJiraRoom = await this.taskTracker.isJiraPartExists(roomData.alias);
        if (!issue && isJiraRoom) {
            return translate('issueNotExistOrPermDen');
        }

        const issueCreator = this.taskTracker.selectors.getIssueCreator(issue);
        const issueCreatorChatId = issueCreator && (await this.chatApi.getUserIdByDisplayName(issueCreator));

        const matrixRoomAdminsId = (await this.chatApi.getRoomAdmins({ roomId: roomData.id })).map(
            ({ userId }) => userId,
        );
        const admins = [issueCreatorChatId, ...matrixRoomAdminsId].filter(Boolean);

        const senderUserId = this.chatApi.getChatUserId(sender);

        if (!admins.includes(senderUserId)) {
            return translate('notAdmin', { sender });
        }

        if (textOptions.has(USER_OPTION)) {
            const userId = textOptions.get(USER_OPTION);

            const res = await actions.kick(this.chatApi, roomData, this.chatApi.getChatUserId(userId));
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

        const kickRes = await actions.kick(this.chatApi, roomData);

        const resMap = {
            [actions.kickStates.NO_POWER]: translate('noBotPower', { power: actions.EXPECTED_POWER }),
            [actions.kickStates.ALL_KICKED]: translate('allKicked'),
            // not care if some users are admin
            [actions.kickStates.ADMINS_EXISTS]: translate('allKicked'),
        };

        return resMap[kickRes];
    }
}
