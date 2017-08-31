const _ = require('lodash');
const R = require('ramda');
const htmlToString = require('html-to-text').fromString;
const jira = require('../../jira');
const {t} = require('../../locales');
const logger = require('simple-color-logger')();

const isCommentHook = R.contains(R.__, ['comment_created', 'comment_updated']);

function pickRendered(issue, comment) {
    const comments = _.get(issue, 'renderedFields.comment.comments');
    if (!(comments instanceof Array)) {
        return comment.body;
    }
    return (
        R.prop(
            'body',
            R.find(R.propEq('id', comment.id), comments)
        ) || comment.body
    );
}

function headerText({comment, webhookEvent}) {
    const fullName = R.path(['author', 'displayName'], comment);
    const event = isCommentHook(webhookEvent) ?
        webhookEvent :
        'comment_created';
    return `${fullName} ${t(event, null, fullName)}`;
}

async function postComment(client, body) {
    logger.info(`Enter in function create comment for hook {${body.webhookEvent}}`);
    const issueID = jira.issue.extractID(JSON.stringify(body));
    const issue = await jira.issue.getFormatted(issueID);
    if (!issue) {
        return;
    }
    const room = await client.getRoomByAlias(issue.key);
    logger.info(`Room for comment ${issue.key}: ${!!room} \n`);
    if (!room) {
        return;
    }
    const message = `${headerText(body)}: <br>${pickRendered(issue, body.comment)}`;
    const success = await client.sendHtmlMessage(room.roomId, htmlToString(message), message);
    if (success) {
        logger.info(`Posted comment to ${issue.key} from ${_.get(body, 'comment.author.name')}\n`);
    }
}

module.exports = {postComment};
