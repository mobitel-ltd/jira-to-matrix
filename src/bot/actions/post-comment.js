const htmlToString = require('html-to-text').fromString;
const logger = require('../../modules/log.js')(module);
const { getCommentHTMLBody, getCommentBody } = require('./helper');
const { getIssueFormatted } = require('../../lib/jira-request.js');

module.exports = async ({ chatApi, issueID, headerText, comment, author }) => {
    try {
        if (!issueID) {
            logger.warn('No IssueId for posting comment. No way to define params for posting comment');
            return;
        }
        const issue = await getIssueFormatted(issueID);
        const roomId = await chatApi.getRoomId(issue.key);

        const commentBody = getCommentBody(issue, comment);
        const htmlBody = getCommentHTMLBody(headerText, commentBody);
        const body = htmlToString(htmlBody);
        await chatApi.sendHtmlMessage(roomId, body, htmlBody);
        logger.debug(`Posted comment ${commentBody} to ${issue.key} from ${author}\n`);

        return true;
    } catch (err) {
        throw ['Error in Post comment', err].join('\n');
    }
};
