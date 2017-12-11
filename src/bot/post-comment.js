const lodash = require('lodash');
const Ramda = require('ramda');
const htmlToString = require('html-to-text').fromString;
const logger = require('../modules/log.js')(module);

const jira = require('../jira');

const pickRendered = (issue, comment) => {
    const comments = lodash.get(issue, 'renderedFields.comment.comments');
    if (!(comments instanceof Array)) {
        return comment.body;
    }

    const result = Ramda.propOr(
        comment.body,
        'body',
        Ramda.find(Ramda.propEq('id', comment.id), comments)
    );

    return result;
};

const postComment = async ({mclient, issueID, headerText, comment, author}) => {
    logger.info('post comment start');
    try {
        logger.debug('data for post comment', {issueID, headerText, comment, author});
        const issue = await jira.issue.getFormatted(issueID);

        if (!issue) {
            throw new Error('no issue');
        }

        const roomId = await mclient.getRoomId(issue.key);
        logger.debug(`Room for comment ${issue.key}: ${!!roomId} \n`);

        if (!roomId) {
            throw new Error('no roomId');
        }

        const commentBody = pickRendered(issue, comment);
        const message = `${headerText}: <br>${commentBody}`;
        await mclient.sendHtmlMessage(roomId, htmlToString(message), message);
        logger.debug(`Posted comment ${commentBody} to ${issue.key} from ${author}\n`);

        return true;
    } catch (err) {
        logger.error('error in Post comment');
        throw err;
    }
};

module.exports = {postComment};
