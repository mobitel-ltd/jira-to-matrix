import * as utils from '../../lib/utils';
import { PostLinkedChangesData } from '../../types';
import { BaseAction } from './base-action';
import { ChatFasade } from '../../messengers/chat-fasade';
import { Jira } from '../../task-trackers/jira';

export class PostLinkedChanges extends BaseAction<ChatFasade, Jira> {
    async handler(data, roomID) {
        const { body, htmlBody } = this.getPostStatusData(data)!;

        await this.chatApi.sendHtmlMessage(roomID, body, htmlBody);
    }

    async run({ linksKeys, data }: PostLinkedChangesData): Promise<true> {
        try {
            const checkedIssues = await Promise.all(
                linksKeys.map(async key => {
                    const issue = await this.taskTracker.getIssueSafety(key);

                    return issue && key;
                }),
            );
            const availableIssues = checkedIssues.filter(Boolean);
            const roomIDs = await Promise.all(availableIssues.map(el => this.chatApi.getRoomIdForJoinedRoom(el)));

            await Promise.all(roomIDs.map(el => this.handler(data, el)));

            return true;
        } catch (err) {
            throw utils.errorTracing('postLinkedChanges', err);
        }
    }
}
