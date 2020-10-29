import { getLogger } from '../../modules/log';
import * as utils from '../../lib/utils';
import { translate } from '../../locales';
import { PostIssueUpdatesData, IssueChanges, TaskTracker } from '../../types';
import { isRepoExists, getRepoLink, exportEvents } from '../../lib/git-lib';
import { kick } from '../commands/command-list/common-actions';
import { ChatFasade } from '../../messengers/chat-fasade';
import { BaseAction } from './base-action';

const logger = getLogger(module);

// usingPojects: 'all' | [string] | undefined

export interface PostIssueUpdatesRes {
    setNewRoomTopic?: string;
    setNewRoomName?: string;
    sendUpdates: string;
    setNewAvatar?: string;
    kickAllOnLastStatus?: string;
}

export class PostIssueUpdates extends BaseAction<ChatFasade, TaskTracker, PostIssueUpdatesRes> {
    private async getNewAvatarUrl(issueKey, { statusId, isNewStatus, hookLabels }) {
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

    static itemsToString(items: IssueChanges[]) {
        return items.reduce((acc, { field, newValue }) => (field ? { ...acc, [field]: newValue } : acc), {});
    }

    static composeText = ({ author, fields, formattedValues }) => {
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

    private async getIssueUpdateInfoMessageBody(changes: IssueChanges[], oldKey, author) {
        const fields = changes.map(el => el.field);
        const renderedValues = await this.taskTracker.getIssueFieldsValues(oldKey, fields);
        const changelogItemsTostring = PostIssueUpdates.itemsToString(changes);

        const formattedValues = { ...changelogItemsTostring, ...renderedValues };

        const htmlBody = PostIssueUpdates.composeText({ author, fields, formattedValues });
        const body = translate('issueHasChanged');

        return { htmlBody, body };
    }

    private async sendUpdates({ changes, oldKey, author }: PostIssueUpdatesData, roomId: string): Promise<string> {
        const info = await this.getIssueUpdateInfoMessageBody(changes, oldKey, author);
        await this.chatApi.sendHtmlMessage(roomId, info.body, info.htmlBody);
        logger.debug(`Posted updates to ${roomId}`);

        return info.htmlBody;
    }

    async isArchiveStatus({
        isNewStatus,
        newStatusId,
        projectKey,
        oldKey,
    }: Pick<PostIssueUpdatesData, 'isNewStatus' | 'oldKey' | 'projectKey' | 'newStatusId'>) {
        if (!isNewStatus) {
            logger.debug('Status is not changed');

            return false;
        }

        if (
            this.config.features.kickOnIssueClose === 'all' ||
            this.config.features.kickOnIssueClose?.includes(projectKey)
        ) {
            return this.taskTracker.isClosedIssue({ statusId: newStatusId, issueKey: oldKey });
        }

        return false;
    }

    private async kickAllOnLastStatus(options: PostIssueUpdatesData, roomId: string): Promise<string | undefined> {
        if (!(await this.isArchiveStatus(options))) {
            return;
        }

        const { baseRemote, baseLink, sshLink, gitReposPath } = this.config;

        const repoName = options.projectKey;

        const { roomData, client } = (await this.chatApi.getRoomAndClient(roomId))!;

        if (this.config.gitArchive) {
            if (!(await isRepoExists(this.config.baseRemote, repoName))) {
                const repoLink = getRepoLink(this.config.baseLink!, options.projectKey);

                logger.warn(translate('repoNotExists', { repoLink }));

                return;
            }

            const listEvents = await this.chatApi.getAllEventsFromRoom(roomId);
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

                return;
            }
        }

        logger.debug(`Git push successfully complited in room ${roomId}!!!`);

        const kickRes = await kick(client, roomData);

        logger.debug(`Result of kicking in room ${roomData.alias} is ${kickRes}`);

        return kickRes;
    }

    private async setNewAvatar(
        { oldKey, isNewStatus, hookLabels, newStatusId }: PostIssueUpdatesData,
        roomId: string,
    ): Promise<string | undefined> {
        const newAvatarUrl = await this.getNewAvatarUrl(oldKey, {
            statusId: newStatusId,
            isNewStatus,
            hookLabels,
        });

        if (newAvatarUrl) {
            await this.chatApi.setRoomAvatar(roomId, newAvatarUrl);

            logger.debug(`Room ${roomId} have got new avatar ${newAvatarUrl}`);

            return newAvatarUrl;
        }
    }

    private async setNewRoomName(
        { newRoomName, oldKey }: PostIssueUpdatesData,
        roomId: string,
    ): Promise<string | undefined> {
        const getRoomName = async (name: string): Promise<string> => {
            const body = await this.taskTracker.getIssue(oldKey);
            if (body.hasOwnProperty('title')) {
                const getMilestone = body => {
                    return body?.milestone === null || undefined ? '' : body.milestone.title;
                };
                const getTitle = body => {
                    return body?.title === null || undefined ? '' : body.title;
                };

                return this.taskTracker.selectors.composeRoomName(oldKey, {
                    summary: getTitle(body),
                    milestone: getMilestone(body),
                });
            }

            return name;
        };

        if (!newRoomName) {
            return;
        }

        const roomName = await getRoomName(newRoomName);

        await this.chatApi.updateRoomName(roomId, roomName);
        logger.debug(`Room ${oldKey} name updated with ${roomName}`);

        return roomName;
    }

    private async setNewRoomTopic({ newKey, oldKey }: PostIssueUpdatesData, roomId: string) {
        if (newKey) {
            const topic = this.taskTracker.getViewUrl(newKey);
            await this.chatApi.updateRoomData(roomId, topic, newKey);
            logger.debug(`Added new topic ${newKey} for room ${oldKey}`);

            return topic;
        }
    }

    async run(options: PostIssueUpdatesData): Promise<false | PostIssueUpdatesRes> {
        try {
            if (!(await this.taskTracker.hasIssue(options.oldKey))) {
                logger.warn(`Issue by key ${options.oldKey} is not exists`);

                return false;
            }

            const roomId = await this.chatApi.getRoomId(options.oldKey);

            return {
                setNewRoomName: await this.setNewRoomName(options, roomId),
                setNewRoomTopic: await this.setNewRoomTopic(options, roomId),
                sendUpdates: await this.sendUpdates(options, roomId),
                setNewAvatar: await this.setNewAvatar(options, roomId),
                kickAllOnLastStatus: await this.kickAllOnLastStatus(options, roomId),
            };
        } catch (err) {
            logger.error(err);
            throw utils.errorTracing('postIssueUpdates', err);
        }
    }
}
