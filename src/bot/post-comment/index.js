/* eslint-disable camelcase */
// const Ramda = require('ramda');
// const {fp} = require('../../utils');
const {postCommentLogic} = require('./post-comment');
const logger = require('debug')('bot post comment');


// const isCommentEvent = ({webhookEvent, issue_event_type_name}) => {
//     const propNotIn = Ramda.complement(fp.propIn);
//     return Ramda.anyPass([
//         fp.propIn('webhookEvent', ['comment_created', 'comment_updated']),
//         Ramda.allPass([
//             Ramda.propEq('webhookEvent', 'jira:issue_updated'),
//             propNotIn('issue_event_type_name', ['issue_commented', 'issue_comment_edited']),
//         ]),
//     ])({webhookEvent, issue_event_type_name} || {});
// };

// const shouldPostComment = ({body, mclient}) => Boolean(
//     typeof body === 'object'
//     && isCommentEvent(body)
//     && typeof body.comment === 'object'
//     && mclient
// );

const postComment = async req => {
    logger('post comment start');
    // if (shouldPostComment(req)) {
    try {
        await postCommentLogic(req.mclient, req.body);
    } catch (err) {
        logger('Error in Post comment', err);
    }
    // }
};

module.exports = {postComment};
// module.exports.forTests = {
//     isCommentEvent,
// };
