// const _ = require('lodash');
// const Ramda = require('ramda');
// const htmlToString = require('html-to-text').fromString;
// const jira = require('../../jira');
// const translate = require('../../locales');
// const logger = require('debug')('bot post comment');

// const isCommentHook = Ramda.contains(Ramda.__, ['comment_created', 'comment_updated']);

// const pickRendered = (issue, comment) => {
//     const comments = _.get(issue, 'renderedFields.comment.comments');
//     if (!(comments instanceof Array)) {
//         return comment.body;
//     }

//     return (
//         Ramda.prop(
//             'body',
//             Ramda.find(Ramda.propEq('id', comment.id), comments)
//         ) || comment.body
//     );
// };

// const headerText = ({comment, webhookEvent}) => {
//     const fullName = Ramda.path(['author', 'displayName'], comment);
//     const event = isCommentHook(webhookEvent) ?
//         webhookEvent :
//         'comment_created';
//     return `${fullName} ${translate(event, null, fullName)}`;
// };

// const postCommentLogic = async (client, body) => {
//     logger(`Enter in function create comment for hook {${body.webhookEvent}}`);
//     const issueID = jira.issue.extractID(JSON.stringify(body));
//     const issue = await jira.issue.getFormatted(issueID);
//     if (!issue) {
//         return;
//     }

//     const roomId = await client.getRoomId(issue.key);
//     logger(`Room for comment ${issue.key}: ${!!roomId} \n`);
//     if (!roomId) {
//         return;
//     }

//     const message = `${headerText(body)}: <br>${pickRendered(issue, body.comment)}`;
//     const success = await client.sendHtmlMessage(roomId, htmlToString(message), message);
//     if (success) {
//         logger(`Posted comment to ${issue.key} from ${_.get(body, 'comment.author.name')}\n`);
//     }
// };

// module.exports = {postCommentLogic};

// const _ = require('lodash');
// const Ramda = require('ramda');
// const htmlToString = require('html-to-text').fromString;
// const jira = require('../../jira');
// const logger = require('debug')('bot post comment logic');

// const pickRendered = (issue, comment) => {
//     const comments = _.get(issue, 'renderedFields.comment.comments');
//     if (!(comments instanceof Array)) {
//         return comment.body;
//     }

//     return (
//         Ramda.prop(
//             'body',
//             Ramda.find(Ramda.propEq('id', comment.id), comments)
//         ) || comment.body
//     );
// };

// const postCommentLogic = async ({mclient, issueID, headerText, comment, author}) => {
//     logger('data for post comment', issueID, headerText, comment, author);
//     const issue = await jira.issue.getFormatted(issueID);
//     logger('issue in postComment', issue);
//     if (!issue) {
//         return;
//     }

//     const roomId = await mclient.getRoomId(issue.key);
//     logger(`Room for comment ${issue.key}: ${!!roomId} \n`);
//     if (!roomId) {
//         return;
//     }

//     const message = `${headerText}: <br>${pickRendered(issue, comment)}`;
//     const success = await mclient.sendHtmlMessage(roomId, htmlToString(message), message);
//     if (success) {
//         logger(`Posted comment to ${issue.key} from ${author}\n`);
//         return true;
//     }
// };

// module.exports = {postCommentLogic};
