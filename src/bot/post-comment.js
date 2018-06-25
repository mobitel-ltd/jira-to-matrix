const Ramda = require('ramda');
const htmlToString = require('html-to-text').fromString;
const logger = require('../modules/log.js')(module);

const {getIssueFormatted} = require('../lib/jira-request.js');

const pickRendered = (issue, comment) => {
    const comments = Ramda.path(['renderedFields', 'comment', 'comments'], issue);
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

module.exports = async ({mclient, issueID, headerText, comment, author}) => {
    logger.debug('Post comment start');
    try {
        const issue = await getIssueFormatted(issueID);
        const roomId = await mclient.getRoomId(issue.key);
        logger.debug(`Room for comment ${issue.key}: ${!!roomId} \n`);

        const commentBody = pickRendered(issue, comment);
        const htmlBody = `${headerText}: <br>${commentBody}`;
        const body = htmlToString(htmlBody);
        await mclient.sendHtmlMessage(roomId, body, htmlBody);
        logger.debug(`Posted comment ${commentBody} to ${issue.key} from ${author}\n`);

        return true;
    } catch (err) {
        throw ['Error in Post comment', err].join('\n');
    }
};
