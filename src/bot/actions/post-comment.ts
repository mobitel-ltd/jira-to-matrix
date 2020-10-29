import { getLogger } from '../../modules/log';
import { fromString } from 'html-to-text';
import { PostCommentData, TaskTracker } from '../../types';
import { BaseAction } from './base-action';
import { ChatFasade } from '../../messengers/chat-fasade';
import marked from 'marked';

const logger = getLogger(module);

export const getCommentHTMLBody = (headerText, commentBody) => `${headerText}: <br>${marked(commentBody)}`;

export class PostComment extends BaseAction<ChatFasade, TaskTracker> {
    async run({ issueId, headerText, comment, author }: PostCommentData) {
        try {
            if (!issueId) {
                logger.warn('No IssueId for posting comment. No way to define params for posting comment');
                return;
            }
            const { key, comments } = await this.taskTracker.getIssueComments(issueId);
            const roomId = await this.chatApi.getRoomId(key);
            const commentBody = comments.find(el => el.id === comment.id)?.body || comment.body;

            const htmlBody = getCommentHTMLBody(headerText, commentBody);
            const body = fromString(htmlBody);
            await this.chatApi.sendHtmlMessage(roomId, body, htmlBody);
            logger.debug(`Posted comment ${commentBody} to ${key} from ${author}\n`);

            return true;
        } catch (err) {
            throw ['Error in Post comment', err].join('\n');
        }
    }
}
