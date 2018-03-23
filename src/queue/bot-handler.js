const logger = require('../modules/log.js')(module);
const Ramda = require('ramda');
const parsers = require('./parse-body.js');
const {getNewStatus} = require('../bot/helper.js');

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
    body
    && typeof body === 'object'
    && isCommentEvent(body)
    && typeof body.comment === 'object'
    && features.postComments
);

const isPostIssueUpdates = body => Boolean(
    body
    && typeof body === 'object'
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
    body
    && typeof body === 'object'
    && body.webhookEvent === 'jira:issue_updated'
    && typeof body.issue === 'object'
    && features.inviteNewMembers
);

const {field: epicUpdatesField} = features.epicUpdates;

const isPostEpicUpdates = body => Boolean(
    body
    && typeof body === 'object'
    && (
        body.webhookEvent === 'jira:issue_updated'
        || (body.webhookEvent === 'jira:issue_created' && typeof body.changelog === 'object')
    )
    && typeof body.issue === 'object'
    && Ramda.path(['issue', 'fields', epicUpdatesField], body)
    && features.epicUpdates.on()
);

const isPostProjectUpdates = body => Boolean(
    body
    && typeof body === 'object'
    && (
        body.webhookEvent === 'jira:issue_updated'
        || (body.webhookEvent === 'jira:issue_created')
    )
    && typeof body.issue === 'object'
    && typeof body.issue.fields === 'object'
    // && Ramda.path(['issue', 'fields', 'project'], body)
    && Ramda.pathEq(['issue', 'fields', 'issuetype', 'name'], 'Epic')(body)
    && (
        body.issue_event_type_name === 'issue_generic'
        || body.issue_event_type_name === 'issue_created'
    )
    && features.epicUpdates.on()
);

const isPostNewLinks = body => Boolean(
    body
    && typeof body === 'object'
    && (
        body.webhookEvent === 'jira:issue_updated'
        || body.webhookEvent === 'jira:issue_created'
    )
    && typeof body.issue === 'object'
    && Ramda.pathOr([], ['issue', 'fields', 'issuelinks'])(body).length > 0
    && features.newLinks
);

const isPostLinkedChanges = body => Boolean(
    body
    && features.postChangesToLinks.on
    && typeof body === 'object'
    && body.webhookEvent === 'jira:issue_updated'
    && typeof body.changelog === 'object'
    && typeof body.issue === 'object'
    && Ramda.pathOr([], ['issue', 'fields', 'issuelinks'])(body).length > 0
    && typeof getNewStatus(body) === 'string'
);

const getBotFunc = body => {
    const actionFuncs = {
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

// Эту переменную можно в конфиг добавить, она по сути константа
// TODO: change until start correct bot work
const redisRoomsKey = 'newrooms';

const getFuncAndBody = body => {
    const botFunc = getBotFunc(body);
    logger.debug('Array of functions we should handle', botFunc);

    let createRoomData = null;
    if (isCreateRoom(body)) {
        createRoomData = parsers.getCreateRoomData(body);
    }
    const roomsData = {redisKey: redisRoomsKey, createRoomData};

    const result = botFunc.reduce((acc, funcName) => {
        const data = {
            ...parsers[getParserName(funcName)](body),
        };

        const redisKey = `${funcName}_${body.timestamp}`;
        logger.debug('redisKey', redisKey);

        return [...acc, {redisKey, funcName, data}];
    }, [roomsData]);

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
    isCommentEvent,
};
