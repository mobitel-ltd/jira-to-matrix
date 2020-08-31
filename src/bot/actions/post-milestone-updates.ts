import marked from 'marked';
import { translate } from '../../locales';
import { getLogger } from '../../modules/log';
import { redis, getRedisMilestoneKey } from '../../redis-client';
import { PostMilestoneUpdatesData, MilestoneUpdateStatus } from '../../types';
import { ChatFasade } from '../../messengers/chat-fasade';
import { BaseAction, RunAction } from './base-action';
import { Gitlab } from '../../task-trackers/gitlab';

const logger = getLogger(module);

export class PostMilestoneUpdates extends BaseAction<ChatFasade, Gitlab> implements RunAction {
    getMessage = ({ summary, key, user }, status: MilestoneUpdateStatus): string => {
        const viewUrl = this.taskTracker.getViewUrl(key);
        const messageMap: Record<
            MilestoneUpdateStatus,
            (options: { viewUrl: string; summary: string; user: string }) => string
        > = {
            [MilestoneUpdateStatus.Created]: options => translate('issueAddedToMilestone', options),
            [MilestoneUpdateStatus.Closed]: options => translate('issueAddedToMilestone', options),
            [MilestoneUpdateStatus.Deleted]: options => translate('issueAddedToMilestone', options),
        };

        return messageMap[status]({ viewUrl, summary, user });
    };

    async postNewIssue(
        milestone: { id: number; key: string; roomId: string },
        issue: { key: string; summary: string; user: string },
    ): Promise<string | undefined> {
        const redisEpicKey = getRedisMilestoneKey(milestone.id);
        if (await redis.isInEpic(redisEpicKey, issue.key)) {
            logger.debug(`Issue ${issue.key} already saved in Redis by milestone ${milestone.key}`);

            return;
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

    async run({ issueKey, milestoneId, status, user, summary }: PostMilestoneUpdatesData): Promise<string> {
        try {
            const issue = await this.taskTracker.getIssue(issueKey);

            const milestoneKey = this.taskTracker.selectors.getMilestoneKey(issue)!;
            const milestoneRoomId = await this.chatApi.getRoomId(milestoneKey);

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
