const _ = require('lodash');
const Ramda = require('ramda');
const htmlToString = require('html-to-text').fromString;
const jira = require('../../jira');
const logger = require('debug')('bot post comment logic');

const pickRendered = (issue, comment) => {
    const comments = _.get(issue, 'renderedFields.comment.comments');
    if (!(comments instanceof Array)) {
        return comment.body;
    }

    return (
        Ramda.prop(
            'body',
            Ramda.find(Ramda.propEq('id', comment.id), comments)
        ) || comment.body
    );
};

const postComment = async ({mclient, issueID, headerText, comment, author}) => {
    logger('post comment start');
    try {
        logger('data for post comment', {issueID, headerText, comment, author});
        const issue = await jira.issue.getFormatted(issueID);

        if (!issue) {
            throw new Error('no issue');
        }

        const roomId = await mclient.getRoomId(issue.key);
        logger(`Room for comment ${issue.key}: ${!!roomId} \n`);

        if (!roomId) {
            throw new Error('no roomId');
        }

        const commentBody = pickRendered(issue, comment);
        const message = `${headerText}: <br>${commentBody}`;
        const success = await mclient.sendHtmlMessage(roomId, htmlToString(message), message);

        if (!success) {
            throw new Error('no send to matrix');
        }

        logger(`Posted comment ${commentBody} to ${issue.key} from ${author}\n`);

        return true;
    } catch (err) {
        logger('Error in Post comment', err);

        return false;
    }
};

module.exports = {postComment};
