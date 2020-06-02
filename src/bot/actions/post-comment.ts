import { getLogger } from '../../modules/log';
import { fromString } from 'html-to-text';
import { PostCommentData, TaskTracker } from '../../types';
import { BaseAction } from './base-action';
import { ChatFasade } from '../../messengers/chat-fasade';

const logger = getLogger(module);

export const getCommentHTMLBody = (headerText, commentBody) => `${headerText}: <br>${commentBody}`;

export class PostComment extends BaseAction<ChatFasade, TaskTracker> {
    async run({ issueID, headerText, comment, author }: PostCommentData) {
        try {
            if (!issueID) {
                logger.warn('No IssueId for posting comment. No way to define params for posting comment');
                return;
            }
            const issue = await this.taskTracker.getIssueComments(issueID);
            const roomId = await this.chatApi.getRoomId(issue.key);
            const commentBody = issue.comments.find(el => el.id === comment.id)?.body || comment.body;

            const htmlBody = getCommentHTMLBody(headerText, commentBody);
            const body = fromString(htmlBody);
            await this.chatApi.sendHtmlMessage(roomId, body, htmlBody);
            logger.debug(`Posted comment ${commentBody} to ${issue.key} from ${author}\n`);

            return true;
        } catch (err) {
            throw ['Error in Post comment', err].join('\n');
        }
    }
}
