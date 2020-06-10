import { getLogger } from '../../modules/log';
import * as utils from '../../lib/utils';
import * as R from 'ramda';
import { translate } from '../../locales';
import { PostIssueUpdatesData, IssueChanges, TaskTracker } from '../../types';
import { isRepoExists, getRepoLink, exportEvents } from '../../lib/git-lib';
import { kick } from '../commands/command-list/common-actions';
import { ChatFasade } from '../../messengers/chat-fasade';
import { BaseAction } from './base-action';
import { LAST_STATUS_COLOR } from '../../redis-client';

const logger = getLogger(module);

// usingPojects: 'all' | [string] | undefined

export class PostIssueUpdates extends BaseAction<ChatFasade, TaskTracker> {
    async getNewAvatarUrl(issueKey, { statusId, colors, usingPojects }) {
        if (!colors) {
            logger.warn(`No color links is passed to update avatar for room ${issueKey}`);

            return;
        }
        if (!statusId) {
            logger.warn(`No statusId is passed to update avatar for room ${issueKey}`);

            return;
        }

        if (this.isAvatarIssueKey(issueKey, usingPojects)) {
            const colorName = await this.taskTracker.getStatusColor(statusId);

            return colorName && colors[colorName];
        }
    }

    itemsToString = (items: IssueChanges[]) =>
        items.reduce((acc, { field, newValue }) => (field ? { ...acc, [field]: newValue } : acc), {});

    composeText = ({ author, fields, formattedValues }) => {
        const message = translate('issue_updated', { name: author });
        const changesDescription = fields.map(field => `${field}: ${formattedValues[field]}`);

        return [message, ...changesDescription].join('<br>');
    };

    async getIssueUpdateInfoMessageBody(changes: IssueChanges[], oldKey, author) {
        const fields = changes.map(el => el.field);
        const renderedValues = await this.taskTracker.getIssueFieldsValues(oldKey, fields);
        const changelogItemsTostring = this.itemsToString(changes);

        const formattedValues = { ...changelogItemsTostring, ...renderedValues };

        const htmlBody = this.composeText({ author, fields, formattedValues });
        const body = translate('issueHasChanged');

        return { htmlBody, body };
    }

    async isArchiveStatus(projectKey: string, statusId?: number | string) {
        if (!statusId) {
            logger.debug('Status is not changed');

            return false;
        }
        const exportConfigParams = this.config.gitArchive;

        const isInConfigArchiveList = R.pipe(
            R.pathOr([], ['options', 'lastIssue']),
            R.includes(projectKey),
        )(exportConfigParams);

        if (isInConfigArchiveList) {
            const colorName = await this.taskTracker.getStatusColor(statusId);

            return colorName === LAST_STATUS_COLOR;
        }

        return false;
    }

    async run({
        newStatusId,
        author,
        changes,
        oldKey,
        newKey,
        newNameData,
        projectKey,
    }: PostIssueUpdatesData): Promise<boolean> {
        try {
            if (!(await this.taskTracker.hasIssue(oldKey))) {
                logger.warn(`Issue by key ${oldKey} is not exists`);

                return false;
            }

            const roomId = await this.chatApi.getRoomId(oldKey);

            if (newKey) {
                const topic = this.taskTracker.getViewUrl(newKey);
                await this.chatApi.updateRoomData(roomId, topic, newKey);
                logger.debug(`Added new topic ${newKey} for room ${oldKey}`);
            }

            if (newNameData) {
                await this.chatApi.updateRoomName(roomId, newNameData);
                logger.debug(`Room ${oldKey} name updated with ${newNameData.summary}`);
            }

            const info = await this.getIssueUpdateInfoMessageBody(changes, oldKey, author);
            await this.chatApi.sendHtmlMessage(roomId, info.body, info.htmlBody);
            logger.debug(`Posted updates to ${roomId}`);

            const newAvatarUrl = await this.getNewAvatarUrl(oldKey, {
                statusId: newStatusId,
                colors: R.path(['colors', 'links'], this.config),
                usingPojects: R.path(['colors', 'projects'], this.config),
            });

            if (newAvatarUrl) {
                await this.chatApi.setRoomAvatar(roomId, newAvatarUrl);

                logger.debug(`Room ${roomId} have got new avatar ${newAvatarUrl}`);
            }

            if (await this.isArchiveStatus(projectKey, newStatusId)) {
                const { baseRemote, baseLink, sshLink, gitReposPath } = this.config;

                const repoName = projectKey;

                if (!(await isRepoExists(this.config.baseRemote, repoName))) {
                    const repoLink = getRepoLink(this.config.baseLink!, projectKey);

                    logger.warn(translate('repoNotExists', { repoLink }));

                    return true;
                }

                const listEvents = await this.chatApi.getAllEventsFromRoom(roomId);
                const { roomData, client } = (await this.chatApi.getRoomAndClient(roomId))!;
                const archivedRoomLinks = await exportEvents({
                    listEvents,
                    roomData,
                    chatApi: client,
                    repoName,
                    baseRemote,
                    baseLink,
                    sshLink,
                    gitReposPath,
                });
                if (!archivedRoomLinks) {
                    logger.debug(translate('archiveFail', { alias: roomData.alias }));

                    return true;
                }

                logger.debug(`Git push successfully complited in room ${roomId}!!!`);

                const kickRes = await kick(client, roomData);

                logger.debug(`Result of kicking in room ${roomData.alias} is ${kickRes}`);
            }

            return true;
        } catch (err) {
            logger.error(err);
            throw utils.errorTracing('postIssueUpdates', err);
        }
    }
}
