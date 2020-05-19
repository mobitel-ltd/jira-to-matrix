import { getLogger } from '../../modules/log';
import { fromString } from 'html-to-text';

const logger = getLogger(module);
const { getCommentHTMLBody, getCommentBody } = require('./helper');

export const postComment = async ({ chatApi, issueID, headerText, comment, author, taskTracker }) => {
    try {
        if (!issueID) {
            logger.warn('No IssueId for posting comment. No way to define params for posting comment');
            return;
        }
        const issue = await taskTracker.getIssueFormatted(issueID);
        const roomId = await chatApi.getRoomId(issue.key);

        const commentBody = getCommentBody(issue, comment);
        const htmlBody = getCommentHTMLBody(headerText, commentBody);
        const body = fromString(htmlBody);
        await chatApi.sendHtmlMessage(roomId, body, htmlBody);
        logger.debug(`Posted comment ${commentBody} to ${issue.key} from ${author}\n`);

        return true;
    } catch (err) {
        throw ['Error in Post comment', err].join('\n');
    }
};
