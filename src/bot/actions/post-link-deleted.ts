import * as utils from '../../lib/utils';
import { DeletedLinksData } from '../../types';
import { getNoIssueLinkLog } from '../../lib/messages';
import { BaseAction } from './base-action';
import { ChatFasade } from '../../messengers/chat-fasade';
import { Jira } from '../../task-trackers/jira';

export class PostLinkDeleted extends BaseAction<ChatFasade, Jira> {
    async postLink(roomId, related, relation): Promise<void> {
        if (roomId) {
            const { body, htmlBody } = this.getPostLinkMessageBody({ relation, related }, 'deleteLink');

            await this.chatApi.sendHtmlMessage(roomId, body, htmlBody);
        }
    }
    async run({
        sourceIssueId,
        destinationIssueId,
        sourceRelation,
        destinationRelation,
    }: DeletedLinksData): Promise<boolean> {
        try {
            const links = [sourceIssueId, destinationIssueId];
            const [sourceIssue, destinationIssue] = await Promise.all(
                links.map(el => this.taskTracker.getIssueSafety(el)),
            );
            if (!sourceIssue && !destinationIssue) {
                throw getNoIssueLinkLog(sourceIssueId, destinationIssueId);
            }
            const [sourceIssueKey, destinationIssueKey] = [sourceIssue, destinationIssue].map(el =>
                this.taskTracker.selectors.getKey(el),
            )!;

            const sourceIssueRoomId = sourceIssueKey && (await this.chatApi.getRoomId(sourceIssueKey));
            const destinationIssueRoomId = destinationIssueKey && (await this.chatApi.getRoomId(destinationIssueKey));

            await this.postLink(sourceIssueRoomId, destinationIssue, sourceRelation);
            await this.postLink(destinationIssueRoomId, sourceIssue, destinationRelation);

            return true;
        } catch (err) {
            throw utils.errorTracing('post delete link', err);
        }
    }
}
