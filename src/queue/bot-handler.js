const logger = require('debug')('bot-handler');
const Ramda = require('ramda');

// const bot = require('../bot');
const {features} = require('../config');
const {fp} = require('../utils');

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

const shouldPostComment = body => Boolean(
    typeof body === 'object'
    && isCommentEvent(body)
    && typeof body.comment === 'object'
    && features.postComments
);

const shouldPostIssueUpdates = body => Boolean(
    typeof body === 'object'
    && body.webhookEvent === 'jira:issue_updated'
    && typeof body.changelog === 'object'
    && typeof body.issue === 'object'
    && features.postIssueUpdates
);

const shouldCreateRoom = body => Boolean(
    typeof body === 'object'
    && typeof body.issue === 'object'
    && body.issue.key
    && body.issue_event_type_name !== 'issue_moved'
    && features.createRoom
);

const shouldMemberInvite = body => Boolean(
    typeof body === 'object'
    && body.webhookEvent === 'jira:issue_updated'
    && typeof body.issue === 'object'
    && features.inviteNewMembers
);

const shouldPostEpicUpdates = body => Boolean(
    typeof body === 'object'
    && (
        body.webhookEvent === 'jira:issue_updated'
        || (body.webhookEvent === 'jira:issue_created' && typeof body.changelog === 'object')
    )
    && typeof body.issue === 'object'
    && features.epicUpdates.on()
);

const shouldPostProjectUpdates = body => Boolean(
    typeof body === 'object'
    && (
        body.webhookEvent === 'jira:issue_updated'
        || (body.webhookEvent === 'jira:issue_created')
    )
    && typeof body.issue === 'object'
    && typeof body.issue.fields === 'object'
    && body.issue.fields.issuetype.name === 'Epic'
    && (
        body.issue_event_type_name === 'issue_generic'
        || body.issue_event_type_name === 'issue_created'
    )
    && features.epicUpdates.on()
);

const shouldPostNewLinks = body => Boolean(
    typeof body === 'object'
    && (
        body.webhookEvent === 'jira:issue_updated'
        || body.webhookEvent === 'jira:issue_created'
    )
    && typeof body.issue === 'object'
    && features.newLinks
);

const shouldPostLinkedChanges = body => Boolean(
    typeof body === 'object'
    && body.webhookEvent === 'jira:issue_updated'
    && typeof body.changelog === 'object'
    && typeof body.issue === 'object'
    && features.postChangesToLinks.on
);

// // shouldPostNewLinks =
const getBotFunc = (body => {
    const actionFuncs = {
        createRoom: shouldCreateRoom(body),
        postIssueUpdates: shouldPostIssueUpdates(body),
        inviteNewMembers: shouldMemberInvite(body),
        postComment: shouldPostComment(body),
        postEpicUpdates: shouldPostEpicUpdates(body),
        postProjectUpdates: shouldPostProjectUpdates(body),
        postNewLinks: shouldPostNewLinks(body),
        postLinkedChanges: shouldPostLinkedChanges(body),
    };


    const funcArr = Object.keys(actionFuncs).filter(key => actionFuncs[key]);
    logger('funcArr to handle', funcArr);
    return funcArr;
});

module.exports = {shouldCreateRoom, getBotFunc};

// const botArr = funcArr.map(func => bot[func]);
// logger('bot createroom', botArr);

// if (features.createRoom) {
//     await bot.createRoom(req);
// }
// if (features.postIssueUpdates) {
//     await bot.postIssueUpdates(req);
// }
// if (features.inviteNewMembers) {
//     await bot.inviteNewMembers(req);
// }
// if (features.postComments) {
//     await bot.postComment(req);
// }
// if (features.epicUpdates.on()) {
//     await bot.postEpicUpdates(req);
//     await bot.postProjectUpdates(req);
// }
// if (features.newLinks) {
//     await bot.postNewLinks(req);
// }
// if (features.postChangesToLinks.on) {
//     await bot.postLinkedChanges(req);
// }
