/* eslint-disable camelcase */
const R = require('ramda')
const { fp } = require('../../utils')
const { postComment } = require('./post-comment')

const isCommentEvent = ({ webhookEvent, issue_event_type_name }) => {
    const propNotIn = R.complement(fp.propIn)
    return R.anyPass([
        fp.propIn('webhookEvent', ['comment_created', 'comment_updated']),
        R.allPass([
            R.propEq('webhookEvent', 'jira:issue_updated'),
            propNotIn('issue_event_type_name', ['issue_commented', 'issue_comment_edited']),
        ]),
    ])({ webhookEvent, issue_event_type_name } || {})
}

const shouldPostComment = ({ body, mclient }) => Boolean(
    typeof body === 'object'
    && isCommentEvent(body)
    && typeof body.comment === 'object'
    && mclient
)

async function middleware(req, rs, next) {
    if (shouldPostComment(req)) {
        await postComment(req.mclient, req.body)
    }
    next()
}

module.exports.middleware = middleware
module.exports.forTests = {
    isCommentEvent,
}
