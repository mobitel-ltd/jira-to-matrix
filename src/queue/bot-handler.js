const logger = require('debug')('bot-handler');
const Ramda = require('ramda');
const _ = require('lodash');

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
    && !(Ramda.isEmpty(Ramda.pathOr([], ['changelog', 'items'], body)))
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

const getBotFunc = body => {
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
};

const getParserName = func => {
    const startCase = _.startCase(_.camelCase(func));
    return `get${startCase.split(' ').join('')}Data`;
};

const getFuncAndBody = (parsers, body) => {
    const funcArr = getBotFunc(body);
    logger('Array of functions we should handle', funcArr);
    const result = funcArr.reduce((acc, funcName) => {
        const data = parsers[getParserName(funcName)](body);
        return [...acc, {funcName, data}];
    }, []);

    return result;
};

module.exports = {
    getFuncAndBody,
    getParserName,
    getBotFunc,
    shouldPostComment,
    shouldPostIssueUpdates,
    shouldCreateRoom,
    shouldMemberInvite,
    shouldPostEpicUpdates,
    shouldPostProjectUpdates,
    shouldPostNewLinks,
    shouldPostLinkedChanges,
};
