import * as R from 'ramda';
import marked from 'marked';
import { translate } from '../../locales';
import { getLogger } from '../../modules/log';
import { redis, getRedisMilestoneKey } from '../../redis-client';
import { PostMilestoneUpdatesData, MilestoneUpdateStatus } from '../../types';
import { ChatFasade } from '../../messengers/chat-fasade';
import { BaseAction } from './base-action';
import { Gitlab } from '../../task-trackers/gitlab';
import { GitlabIssue, Milestone } from '../../task-trackers/gitlab/types';

const logger = getLogger(module);

type MessageWithSendStatus = { send: boolean; message: string };

export class PostMilestoneUpdates extends BaseAction<ChatFasade, Gitlab> {
    static alreadyAddedToMilestoneMessage = (issueKey, milestoneId) =>
        `Issue ${issueKey} is already added to milestone ${milestoneId}`;

    getMessage = ({ summary, key, user }, status: MilestoneUpdateStatus): string => {
        const viewUrl = this.taskTracker.getViewUrl(key);
        const messageMap: Record<
            MilestoneUpdateStatus,
            (options: { viewUrl: string; summary: string; user: string }) => string
        > = {
            [MilestoneUpdateStatus.Created]: options => translate('issueAddedToMilestone', options),
            [MilestoneUpdateStatus.Closed]: options => translate('issueClosedInMilestone', options),
            [MilestoneUpdateStatus.Deleted]: options => translate('issueDeletedFromMilestone', options),
            [MilestoneUpdateStatus.Reopen]: options => translate('issueReopenInMilestone', options),
        };

        return messageMap[status]({ viewUrl, summary, user });
    };

    async getNewAvatarUrl(issueKey: string, milestone: Milestone) {
        if (!this.config.colors) {
            logger.warn(`No color links is passed to update avatar for room ${issueKey}`);

            return;
        }
        const colors = this.taskTracker.getMilestoneColors(milestone);
        return await this.getAvatarLink(issueKey, colors);
    }

    async inviteNewMembers(
        roomId: string,
        milestoneKey: string,
        issueBody: GitlabIssue,
    ): Promise<string[] | undefined> {
        const chatRoomMembers = await this.chatApi.getRoomMembers({ roomId });

        // const milestoneUrl = this.taskTracker.getMilestoneUrl(issueBody);
        // if (milestoneUrl) {
        //     const milestoneWatchers = await this.taskTracker.getMilestoneWatchers(milestoneUrl);
        const assignees = this.taskTracker.selectors.getAssigneeUserId(issueBody);
        const milestoneWatchersChatIds = await Promise.all(
            assignees.map(userId => this.currentChatItem.getChatUserId(userId)),
        );
        const {
            messenger: { bots },
        } = this.config;

        const botsChatIds = bots.map(({ user }) => user).map(user => this.chatApi.getChatUserId(user));

        const newMembers = R.difference(milestoneWatchersChatIds, [...chatRoomMembers, ...botsChatIds]).filter(Boolean);

        await Promise.all(
            newMembers.map(async userID => {
                await this.chatApi.invite(roomId, userID);
                logger.debug(`New member ${userID} invited to ${milestoneKey}`);
            }),
        );

        return newMembers;
        // }
    }

    async getMessageByStatus(
        status: MilestoneUpdateStatus,
        milestone: { key: string },
        issue: { key: string; summary: string; user: string },
    ): Promise<MessageWithSendStatus> {
        const actionsByStatus: Record<
            MilestoneUpdateStatus,
            () => Promise<MessageWithSendStatus> | MessageWithSendStatus
        > = {
            [MilestoneUpdateStatus.Created]: async () => {
                const redisEpicKey = getRedisMilestoneKey(milestone.key);
                if (await redis.isInMilestone(redisEpicKey, issue.key)) {
                    const message = PostMilestoneUpdates.alreadyAddedToMilestoneMessage(issue.key, milestone.key);
                    logger.debug(message);

                    return { send: false, message };
                }

                await redis.addToList(redisEpicKey, issue.key);

                const message = this.getMessage(issue, MilestoneUpdateStatus.Created);

                return { message, send: true };
            },
            [MilestoneUpdateStatus.Closed]: () => {
                const message = this.getMessage(issue, MilestoneUpdateStatus.Closed);

                return { message, send: true };
            },
            [MilestoneUpdateStatus.Reopen]: () => {
                const message = this.getMessage(issue, MilestoneUpdateStatus.Reopen);

                return { message, send: true };
            },
            [MilestoneUpdateStatus.Deleted]: async () => {
                const redisEpicKey = getRedisMilestoneKey(milestone.key);
                if (await redis.isInMilestone(redisEpicKey, issue.key)) {
                    await redis.remFromList(redisEpicKey, issue.key);
                    logger.debug(`Removed issue key ${issue.key} from milestone ${milestone.key} in redis`);
                }

                const message = this.getMessage(issue, MilestoneUpdateStatus.Deleted);

                return { message, send: true };
            },
        };

        const action = actionsByStatus[status];

        return await action();
    }

    async run({ issueKey, milestoneId, status, user, summary }: PostMilestoneUpdatesData): Promise<string | undefined> {
        try {
            const issue = await this.taskTracker.getIssue(issueKey);
            const milestoneKey = this.taskTracker.selectors.getMilestoneKey(issue, milestoneId)!;
            const milestoneRoomId = await this.chatApi.getRoomId(milestoneKey);

            await this.inviteNewMembers(milestoneRoomId, milestoneKey, issue);
            const roomData = await this.chatApi.getRoomDataById(milestoneRoomId);
            const roomName = await this.taskTracker.selectors.getMilestoneRoomName(issue);

            if (roomName && roomData !== roomData?.name) {
                await this.chatApi.updateRoomName(milestoneRoomId, roomName);
            }

            const res = await this.getMessageByStatus(status, { key: milestoneKey }, { key: issueKey, summary, user });

            if (res.send) {
                await this.chatApi.sendHtmlMessage(milestoneRoomId, res.message, marked(res.message));

                if (issue.milestone) {
                    const newAvatarUrl = await this.getNewAvatarUrl(issueKey, issue.milestone);
                    if (newAvatarUrl) {
                        await this.chatApi.setRoomAvatar(milestoneRoomId, newAvatarUrl);

                        logger.debug(`Room ${milestoneRoomId} have got new avatar ${newAvatarUrl}`);
                    }
                }
            }

            return res.message;
        } catch (err) {
            throw ['Error in PostMilestoneUpdates', err].join('\n');
        }
    }
}
