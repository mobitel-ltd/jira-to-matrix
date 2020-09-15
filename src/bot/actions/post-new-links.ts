import * as utils from '../../lib/utils';
import { getLogger } from '../../modules/log';
import { redis } from '../../redis-client';
import { PostNewLinksData } from '../../types';
import { BaseAction } from './base-action';
import { ChatFasade } from '../../messengers/chat-fasade';
import { Jira } from '../../task-trackers/jira';

const logger = getLogger(module);

export class PostNewLinks extends BaseAction<ChatFasade, Jira> {
    async postLink(key, relations): Promise<void> {
        const issue = await this.taskTracker.getIssueSafety(key);
        if (issue) {
            const roomID = await this.chatApi.getRoomId(key);

            const { body, htmlBody } = this.getPostLinkMessageBody(relations);
            await this.chatApi.sendHtmlMessage(roomID, body, htmlBody);
        }
    }

    async handleLink(issueLinkId) {
        try {
            if (!(await redis.isNewLink(issueLinkId))) {
                logger.debug(`link ${issueLinkId} is already been posted to room`);
                return;
            }

            const link = await this.taskTracker.getLinkedIssue(issueLinkId);
            const { inward, outward } = this.taskTracker.selectors.getRelations(link);

            await this.postLink(this.taskTracker.selectors.getOutwardLinkKey(link), inward);
            await this.postLink(this.taskTracker.selectors.getInwardLinkKey(link), outward);
            logger.debug(`Issue link ${issueLinkId} is successfully posted!`);
        } catch (err) {
            throw utils.errorTracing('handleLink', err);
        }
    }

    async run({ links }: PostNewLinksData): Promise<true> {
        try {
            await Promise.all(links.map(el => this.handleLink(el)));
            return true;
        } catch (err) {
            throw utils.errorTracing('post new link', err);
        }
    }
}
