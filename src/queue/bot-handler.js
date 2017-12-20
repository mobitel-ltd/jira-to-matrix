const logger = require('../modules/log.js')(module);
const Ramda = require('ramda');
const parsers = require('./parse-body.js');

// const bot = require('../bot');
const {features} = require('../config');
const {fp} = require('../utils');

const isCommentEvent = ({webhookEvent, issue_event_type_name: issueEventTypeName}) => {
    const propNotIn = Ramda.complement(fp.propIn);
    return Ramda.anyPass([
        fp.propIn('webhookEvent', ['comment_created', 'comment_updated']),
        Ramda.allPass([
            Ramda.propEq('webhookEvent', 'jira:issue_updated'),
            propNotIn('issueEventTypeName', ['issue_commented', 'issue_comment_edited']),
        ]),
    ])({webhookEvent, issueEventTypeName} || {});
};

const isPostComment = body => Boolean(
    typeof body === 'object'
    && isCommentEvent(body)
    && typeof body.comment === 'object'
    && features.postComments
);

const isPostIssueUpdates = body => Boolean(
    typeof body === 'object'
    && body.webhookEvent === 'jira:issue_updated'
    && typeof body.changelog === 'object'
    && typeof body.issue === 'object'
    && !(Ramda.isEmpty(Ramda.pathOr([], ['changelog', 'items'], body)))
    && features.postIssueUpdates
);

const isCreateRoom = body => Boolean(
    body
    && typeof body.issue === 'object'
    && body.issue.key
    && body.issue_event_type_name !== 'issue_moved'
    && features.createRoom
);

const isMemberInvite = body => Boolean(
    typeof body === 'object'
    && body.webhookEvent === 'jira:issue_updated'
    && typeof body.issue === 'object'
    && features.inviteNewMembers
);

const isPostEpicUpdates = body => Boolean(
    typeof body === 'object'
    && (
        body.webhookEvent === 'jira:issue_updated'
        || (body.webhookEvent === 'jira:issue_created' && typeof body.changelog === 'object')
    )
    && typeof body.issue === 'object'
    && features.epicUpdates.on()
);

const isPostProjectUpdates = body => Boolean(
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

const isPostNewLinks = body => Boolean(
    typeof body === 'object'
    && (
        body.webhookEvent === 'jira:issue_updated'
        || body.webhookEvent === 'jira:issue_created'
    )
    && typeof body.issue === 'object'
    && features.newLinks
);

const isPostLinkedChanges = body => Boolean(
    typeof body === 'object'
    && body.webhookEvent === 'jira:issue_updated'
    && typeof body.changelog === 'object'
    && typeof body.issue === 'object'
    && features.postChangesToLinks.on
);

const getBotFunc = body => {
    const actionFuncs = {
        // createRoom: isCreateRoom(body),
        postIssueUpdates: isPostIssueUpdates(body),
        inviteNewMembers: isMemberInvite(body),
        postComment: isPostComment(body),
        postEpicUpdates: isPostEpicUpdates(body),
        postProjectUpdates: isPostProjectUpdates(body),
        postNewLinks: isPostNewLinks(body),
        postLinkedChanges: isPostLinkedChanges(body),
    };

    const funcArr = Object.keys(actionFuncs).filter(key => actionFuncs[key]);
    return funcArr;
};

const getParserName = func =>
    `get${func[0].toUpperCase()}${func.slice(1)}Data`;

const getFuncAndBody = body => {
    const botFunc = getBotFunc(body);
    logger.debug('Array of functions we should handle', botFunc);

    const result = botFunc.reduce((acc, funcName) => {
        let createRoomData = null;
        if (isCreateRoom(body)) {
            createRoomData = parsers.getCreateRoomData(body);
        }

        const data = {
            ...parsers[getParserName(funcName)](body),
            createRoomData,
        };
        logger.debug('data', data);

        const redisKey = `${funcName}_${body.timestamp}`;
        logger.debug('redisKey', redisKey);

        return [...acc, {redisKey, funcName, data}];
    }, []);

    return result;
};

module.exports = {
    getFuncAndBody,
    getParserName,
    getBotFunc,
    isPostComment,
    isPostIssueUpdates,
    isCreateRoom,
    isMemberInvite,
    isPostEpicUpdates,
    isPostProjectUpdates,
    isPostNewLinks,
    isPostLinkedChanges,
};
