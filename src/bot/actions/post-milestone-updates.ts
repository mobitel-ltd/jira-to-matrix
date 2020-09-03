import * as R from 'ramda';
import marked from 'marked';
import { translate } from '../../locales';
import { getLogger } from '../../modules/log';
import { redis, getRedisMilestoneKey } from '../../redis-client';
import { PostMilestoneUpdatesData, MilestoneUpdateStatus } from '../../types';
import { ChatFasade } from '../../messengers/chat-fasade';
import { BaseAction, RunAction } from './base-action';
import { Gitlab } from '../../task-trackers/gitlab';
import { GitlabIssue } from '../../task-trackers/gitlab/types';

const logger = getLogger(module);

export class PostMilestoneUpdates extends BaseAction<ChatFasade, Gitlab> implements RunAction {
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
        };

        return messageMap[status]({ viewUrl, summary, user });
    };

    async postNewIssue(
        milestone: { id: number; key: string; roomId: string },
        issue: { key: string; summary: string; user: string },
    ): Promise<string | undefined> {
        const redisEpicKey = getRedisMilestoneKey(milestone.id);
        if (await redis.isInEpic(redisEpicKey, issue.key)) {
            const message = PostMilestoneUpdates.alreadyAddedToMilestoneMessage(issue.key, milestone.id);
            logger.debug(message);

            return message;
        }

        await redis.addToList(redisEpicKey, issue.key);

        const message = this.getMessage(issue, MilestoneUpdateStatus.Created);

        await this.chatApi.sendHtmlMessage(milestone.roomId, marked(message));
        logger.info(`Info about issue ${issue.key} added to milestone ${milestone.key}`);

        return message;
    }

    private async postIssueDeletedInfo(
        milestone: { id: number; key: string; roomId: string },
        issue: { key: string; summary: string; user: string },
    ): Promise<string> {
        const redisEpicKey = getRedisMilestoneKey(milestone.id);
        if (await redis.isInEpic(redisEpicKey, issue.key)) {
            await redis.remFromList(redisEpicKey, issue.key);
            logger.debug(`Removed issue key ${issue.key} from milestone ${milestone.id} in redis`);
        }

        const message = this.getMessage(issue, MilestoneUpdateStatus.Deleted);

        await this.chatApi.sendHtmlMessage(milestone.roomId, marked(message));
        logger.info(`Info about issue ${issue.key} deleting is added to milestone ${milestone.key}`);

        return message;
    }

    private async postIssueClosedInfo(
        milestone: { id: number; key: string; roomId: string },
        issue: { key: string; summary: string; user: string },
    ): Promise<string> {
        const message = this.getMessage(issue, MilestoneUpdateStatus.Closed);

        await this.chatApi.sendHtmlMessage(milestone.roomId, marked(message));
        logger.info(`Info about issue ${issue.key} closing is added to milestone ${milestone.key}`);

        return message;
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
        const assignees = this.taskTracker.selectors.getAssigneeDisplayName(issueBody);
        const milestoneWatchersChatIds = await Promise.all(
            assignees.map(displayName => this.currentChatItem.getUserIdByDisplayName(displayName)),
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

    async run({ issueKey, milestoneId, status, user, summary }: PostMilestoneUpdatesData): Promise<string> {
        try {
            const issue = await this.taskTracker.getIssue(issueKey);

            const milestoneKey = this.taskTracker.selectors.getMilestoneKey(issue, milestoneId)!;
            const milestoneRoomId = await this.chatApi.getRoomId(milestoneKey);

            await this.inviteNewMembers(milestoneRoomId, milestoneKey, issue);

            const actionsByStatus = {
                [MilestoneUpdateStatus.Created]: this.postNewIssue,
                [MilestoneUpdateStatus.Closed]: this.postIssueClosedInfo,
                [MilestoneUpdateStatus.Deleted]: this.postIssueDeletedInfo,
            };

            const action = actionsByStatus[status].bind(this);
            const res = await action(
                { id: milestoneId, key: milestoneKey, roomId: milestoneRoomId },
                { key: issueKey, summary, user },
            );

            return res;
        } catch (err) {
            throw ['Error in PostMilestoneUpdates', err].join('\n');
        }
    }
}
