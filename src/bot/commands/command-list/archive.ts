import * as R from 'ramda';
import * as utils from '../../../lib/utils';
import { translate } from '../../../locales';
import { getLogger } from '../../../modules/log';
import { setAlias } from '../../settings';
import { exportEvents, isRepoExists, getRepoLink } from '../../../lib/git-lib';
import { EXPECTED_POWER, kickStates, kick, parseBodyText } from './common-actions';
import { Command, RunCommand } from './command-base';
import { CommandOptions } from '../../../types';
import { Jira } from '../../../task-trackers/jira';

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

export class ArchiveCommand extends Command<Jira> implements RunCommand {
    async run({ bodyText = '', sender, roomData }: CommandOptions) {
        const { alias, id } = roomData;
        if (!alias) {
            return translate('noAlias');
        }

        const issue = await this.taskTracker.getIssueSafety(alias);
        const isJiraRoom = await this.taskTracker.isJiraPartExists(alias);
        if (!issue && isJiraRoom) {
            return translate('issueNotExistOrPermDen');
        }

        const issueMembersChatIds = await Promise.all(
            this.taskTracker.selectors
                .getIssueMembers(issue)
                .map(displayName => this.chatApi.getUserIdByDisplayName(displayName)),
        );
        const matrixRoomAdminsId = (await this.chatApi.getRoomAdmins({ roomId: id })).map(({ userId }) => userId);
        const admins = [...issueMembersChatIds, ...matrixRoomAdminsId].filter(Boolean);

        const senderUserId = this.chatApi.getChatUserId(sender);

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
                    this.chatApi.getChatUserId.bind(this.chatApi),
                    R.when(R.pathEq([0], '@'), R.drop(1)),
                    R.replace(/[^a-z0-9_.-]+/g, '__') as any,
                ),
            ],
            [R.always(isJiraRoom), R.always(utils.getProjectKeyFromIssueKey(alias))],
        ])(sender);

        if (!(await isRepoExists(this.config.baseRemote, repoName))) {
            const repoLink = getRepoLink(this.config.baseLink!, repoName);

            return translate('repoNotExists', { repoLink });
        }

        const listEvents = await this.chatApi.getAllEventsFromRoom(id);
        const archivedRoomLinks = await exportEvents({
            listEvents,
            roomData,
            chatApi: this.chatApi,
            repoName,
            ...(this.config as any),
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

        const kickRes = await kick(this.chatApi, roomData);

        switch (kickRes) {
            case kickStates.NO_POWER: {
                const msg = translate('noBotPower', { power: EXPECTED_POWER });

                return [successExportMsg, msg].join('<br>');
            }
            case kickStates.ALL_KICKED: {
                // all are deleted and no message is needed
                await deleteAlias(this.chatApi, roomData.alias);
                await this.chatApi.leaveRoom(roomData.id);
                return;
            }
            case kickStates.ADMINS_EXISTS: {
                const msg = translate('adminsAreNotKicked');
                const sendedMsg = [successExportMsg, msg].join('<br>');
                await this.chatApi.sendHtmlMessage(roomData.id, sendedMsg, sendedMsg);
                await this.chatApi.leaveRoom(roomData.id);
            }
        }
    }
}
