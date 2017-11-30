const _ = require('lodash');
const Ramda = require('ramda');
const translate = require('../../locales');
const logger = require('debug')('parse-body-jira');
const jira = require('../../jira');

const postCommentData = body => {
    logger(`Enter in function create comment for hook {${body.webhookEvent}}`);

    const isCommentHook = Ramda.contains(Ramda.__, ['comment_created', 'comment_updated']);

    const headerText = ({comment, webhookEvent}) => {
        const fullName = Ramda.path(['author', 'displayName'], comment);
        const event = isCommentHook(webhookEvent) ?
            webhookEvent :
            'comment_created';
        return `${fullName} ${translate(event, null, fullName)}`;
    };

    const issueID = jira.issue.extractID(JSON.stringify(body));
    logger('issueID', issueID);
    const {comment} = body;

    const author = _.get(body, 'comment.author.name');

    return {issueID, headerText, comment, author};
};

module.exports = {postCommentData};
