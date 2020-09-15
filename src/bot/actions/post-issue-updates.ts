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
import { GitlabLabelHook } from 'src/task-trackers/gitlab/types';

const logger = getLogger(module);

// usingPojects: 'all' | [string] | undefined

export class PostIssueUpdates extends BaseAction<ChatFasade, TaskTracker> {
    async getNewAvatarUrl(issueKey, { statusId, isNewStatus, hookLabels }) {
        if (!this.config.colors) {
            logger.warn(`No color links is passed to update avatar for room ${issueKey}`);

            return;
        }
        if (!statusId && !isNewStatus) {
            logger.warn(`No statusId is passed to update avatar for room ${issueKey}`);

            return;
        }

        if (this.isIssueUseAvatars(issueKey)) {
            const colors = await this.taskTracker.getCurrentIssueColor(issueKey, hookLabels);

            return await this.getAvatarLink(issueKey, colors);
        }
    }

    itemsToString = (items: IssueChanges[]) =>
        items.reduce((acc, { field, newValue }) => (field ? { ...acc, [field]: newValue } : acc), {});

    composeText = ({ author, fields, formattedValues }) => {
        const message = translate('issue_updated', { name: author });
        if (fields.includes('milestone_id')) {
            const changesDescription = ['Milestone was changed'];
            return [message, ...changesDescription].join('<br>');
        }
        if (fields.includes('total_time_spent')) {
            const hoursFromSecond = field => (field / 60 / 60).toFixed(2);
            const changesDescription = fields.map(field => `${field}: ${hoursFromSecond(formattedValues[field])}h`);
            return [message, ...changesDescription].join('<br>');
        } else {
            const changesDescription = fields.map(field => `${field}: ${formattedValues[field]}`);
            return [message, ...changesDescription].join('<br>');
        }
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

    async isArchiveStatus(
        projectKey: string,
        issueKey: string,
        statusId?: number | string,
        hookLabels: GitlabLabelHook[] = [],
    ) {
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
            const colorName = await this.taskTracker.getStatusColor({ statusId, issueKey, hookLabels });

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
        newRoomName,
        projectKey,
        isNewStatus,
        hookLabels,
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

            if (newRoomName) {
                const body = await this.taskTracker.getIssue(oldKey);

                if (body.hasOwnProperty('title')) {
                    const getMilestone = body => {
                        return body?.milestone === null || undefined ? '' : body.milestone.title;
                    };
                    const getTitle = body => {
                        return body?.title === null || undefined ? '' : body.title;
                    };

                    newRoomName = this.taskTracker.selectors.composeRoomName(oldKey, {
                        summary: getTitle(body),
                        milestone: getMilestone(body),
                    });
                }

                await this.chatApi.updateRoomName(roomId, newRoomName);
                logger.debug(`Room ${oldKey} name updated with ${newRoomName}`);
            }

            const info = await this.getIssueUpdateInfoMessageBody(changes, oldKey, author);
            await this.chatApi.sendHtmlMessage(roomId, info.body, info.htmlBody);
            logger.debug(`Posted updates to ${roomId}`);
            const newAvatarUrl = await this.getNewAvatarUrl(oldKey, {
                statusId: newStatusId,
                isNewStatus,
                hookLabels,
            });

            if (newAvatarUrl) {
                await this.chatApi.setRoomAvatar(roomId, newAvatarUrl);

                logger.debug(`Room ${roomId} have got new avatar ${newAvatarUrl}`);
            }

            if (await this.isArchiveStatus(projectKey, oldKey, newStatusId, hookLabels)) {
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
