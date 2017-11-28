const logger = require('debug')('bot-handler');
const bot = require('../bot');
const {features} = require('../config');

// const shouldPostIssueUpdates = body => Boolean(
//     typeof body === 'object'
//     && body.webhookEvent === 'jira:issue_updated'
//     && typeof body.changelog === 'object'
//     && typeof body.issue === 'object'
//     && features.postIssueUpdates
// );

// const shouldCreateRoom = body => Boolean(
//     typeof body === 'object'
//     && typeof body.issue === 'object'
//     && body.issue.key
//     && body.issue_event_type_name !== 'issue_moved'
//     && features.createRoom
// );

// const shouldMemberInvite = body => Boolean(
//     typeof body === 'object'
//     && body.webhookEvent === 'jira:issue_updated'
//     && typeof body.issue === 'object'
//     && features.inviteNewMembers
// );

// const shouldPostComments = body => Boolean(
//     typeof body === 'object'
//     && body.webhookEvent === 'jira:issue_updated'
//     && typeof body.changelog === 'object'
//     && typeof body.issue === 'object'
//     && features.postComments
// );

// const shouldPostEpicUpdates = body => Boolean(
//     typeof body === 'object'
//     && (
//         body.webhookEvent === 'jira:issue_updated'
//         || (body.webhookEvent === 'jira:issue_created' && typeof body.changelog === 'object')
//     )
//     && typeof body.issue === 'object'
//     && features.epicUpdates.on()
// );

// const shouldPostProjectUpdates = body => Boolean(
//     typeof body === 'object'
//     && (
//         body.webhookEvent === 'jira:issue_updated'
//         || (body.webhookEvent === 'jira:issue_created')
//     )
//     && typeof body.issue === 'object'
//     && typeof body.issue.fields === 'object'
//     && body.issue.fields.issuetype.name === 'Epic'
//     && (
//         body.issue_event_type_name === 'issue_generic'
//         || body.issue_event_type_name === 'issue_created'
//     )
//     && features.epicUpdates.on()
// );

// const shouldPostNewLinks = body => Boolean(
//     typeof body === 'object'
//     && (
//         body.webhookEvent === 'jira:issue_updated'
//         || body.webhookEvent === 'jira:issue_created'
//     )
//     && typeof body.issue === 'object'
//     && features.newLinks
// );

// const shouldPostLinkedChanges = body => Boolean(
//     typeof body === 'object'
//     && body.webhookEvent === 'jira:issue_updated'
//     && typeof body.changelog === 'object'
//     && typeof body.issue === 'object'
//     && features.postChangesToLinks.on
// );

// // shouldPostNewLinks =
module.exports = (async req => {
//     const {body} = req;

//     const actionFuncs = {
//         createRoom: shouldCreateRoom(body),
//         postIssueUpdates: shouldPostIssueUpdates(body),
//         inviteNewMembers: shouldMemberInvite(body),
//         postComments: shouldPostComments(body),
//         postEpicUpdates: shouldPostEpicUpdates(body),
//         postProjectUpdates: shouldPostProjectUpdates(body),
//         postNewLinks: shouldPostNewLinks(body),
//         postLinkedChanges: shouldPostLinkedChanges(body),
//     };


//     const funcArr = Object.keys(actionFuncs).filter(key => actionFuncs[key]);
//     logger('funcArr to handle', funcArr);
    if (features.createRoom) {
        await bot.createRoom(req);
        await bot.postIssueDescription(req);
    }
    if (features.postIssueUpdates) {
        await bot.postIssueUpdates(req);
    }
    if (features.inviteNewMembers) {
        await bot.inviteNewMembers(req);
    }
    if (features.postComments) {
        await bot.postComment(req);
    }
    if (features.epicUpdates.on()) {
        await bot.postEpicUpdates(req);
        await bot.postProjectUpdates(req);
    }
    if (features.newLinks) {
        await bot.postNewLinks(req);
    }
    if (features.postChangesToLinks.on) {
        await bot.postLinkedChanges(req);
    }
});
