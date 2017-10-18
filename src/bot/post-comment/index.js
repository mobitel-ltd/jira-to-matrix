/* eslint-disable camelcase */
const Ramda = require('ramda');
const {fp} = require('../../utils');
const {postComment} = require('./post-comment');

const isCommentEvent = ({webhookEvent, issue_event_type_name}) => {
    const propNotIn = Ramda.complement(fp.propIn);
    return Ramda.anyPass([
        fp.propIn('webhookEvent', ['comment_created', 'comment_updated']),
        Ramda.allPass([
            Ramda.propEq('webhookEvent', 'jira:issue_updated'),
            propNotIn('issue_event_type_name', ['issue_commented', 'issue_comment_edited']),
        ]),
    ])({webhookEvent, issue_event_type_name} || {});
};

const shouldPostComment = ({body, mclient}) => Boolean(
    typeof body === 'object'
    && isCommentEvent(body)
    && typeof body.comment === 'object'
    && mclient
);

async function middleware(req) {
    if (shouldPostComment(req)) {
        await postComment(req.mclient, req.body);
    }
}

module.exports.middleware = middleware;
module.exports.forTests = {
    isCommentEvent,
};
