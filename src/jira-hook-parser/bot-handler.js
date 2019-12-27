const parsers = require('./parse-body.js');
const utils = require('../lib/utils.js');
const { features } = require('../config');

const isPostComment = body => features.postComments && utils.isCommentEvent(body) && utils.getComment(body);

const isPostIssueUpdates = body =>
    features.postIssueUpdates && utils.isCorrectWebhook(body, 'jira:issue_updated') && utils.getChangelog(body);

const isCreateRoom = body =>
    (features.createRoom || features.noIssueRooms) && utils.getKey(body) && utils.getTypeEvent(body) !== 'issue_moved';

// const isMemberInvite = body =>
//     (features.inviteNewMembers || features.noIssueRooms) && utils.isCorrectWebhook(body, 'jira:issue_updated');

const isMemberInvite = body => features.inviteNewMembers && utils.isCorrectWebhook(body, 'jira:issue_updated');

const isPostEpicUpdates = body =>
    features.epicUpdates.on() &&
    (utils.isCorrectWebhook(body, 'jira:issue_updated') ||
        (utils.isCorrectWebhook(body, 'jira:issue_created') && utils.getChangelog(body))) &&
    utils.getEpicKey(body);

const isPostProjectUpdates = body =>
    features.epicUpdates.on() &&
    (utils.isCorrectWebhook(body, 'jira:issue_updated') || utils.isCorrectWebhook(body, 'jira:issue_created')) &&
    utils.isEpic(body) &&
    (utils.getTypeEvent(body) === 'issue_generic' || utils.getTypeEvent(body) === 'issue_created');

const isPostNewLinks = body =>
    (features.newLinks &&
        ((utils.isCorrectWebhook(body, 'jira:issue_updated') || utils.isCorrectWebhook(body, 'jira:issue_created')) &&
            utils.getLinks(body).length > 0)) ||
    utils.getBodyWebhookEvent(body) === 'issuelink_created';

const isPostLinkedChanges = body =>
    features.postChangesToLinks.on &&
    utils.isCorrectWebhook(body, 'jira:issue_updated') &&
    utils.getChangelog(body) &&
    utils.getLinks(body).length > 0 &&
    typeof utils.getNewStatus(body) === 'string';

const isDeleteLinks = body => utils.getBodyWebhookEvent(body) === 'issuelink_deleted';

const isPostParentUpdates = body =>
    features.noIssueRooms &&
    (utils.isCorrectWebhook(body, 'jira:issue_updated') ||
        (utils.isCorrectWebhook(body, 'jira:issue_created') && utils.getChangelog(body)));

const actionFuncs = {
    postIssueUpdates: isPostIssueUpdates,
    inviteNewMembers: isMemberInvite,
    postComment: isPostComment,
    postEpicUpdates: isPostEpicUpdates,
    postProjectUpdates: isPostProjectUpdates,
    postNewLinks: isPostNewLinks,
    postLinkedChanges: isPostLinkedChanges,
    postLinksDeleted: isDeleteLinks,
};

const noIssueRoomsFuncs = {
    postParentUpdates: isPostParentUpdates,
    // inviteNewMembers: isMemberInvite,
};

const getBotActions = body => {
    const funcs = features.noIssueRooms ? noIssueRoomsFuncs : actionFuncs;

    return Object.keys(funcs).filter(key => funcs[key](body));
};

const getParserName = func => `get${func[0].toUpperCase()}${func.slice(1)}Data`;

const getFuncRedisData = body => funcName => {
    const parserName = getParserName(funcName);
    const data = parsers[parserName](body);
    const redisKey = utils.getRedisKey(funcName, body);

    return { redisKey, funcName, data };
};
const getFuncAndBody = body => {
    const botFunc = getBotActions(body);
    const createRoomData = isCreateRoom(body) && parsers.getCreateRoomData(body, features.noIssueRooms);
    const roomsData = { redisKey: utils.REDIS_ROOM_KEY, createRoomData };
    const funcsData = botFunc.map(getFuncRedisData(body));

    return [roomsData, ...funcsData];
};

module.exports = {
    isDeleteLinks,
    getFuncAndBody,
    getParserName,
    getBotActions,
    isPostComment,
    isPostIssueUpdates,
    isCreateRoom,
    isMemberInvite,
    isPostEpicUpdates,
    isPostProjectUpdates,
    isPostNewLinks,
    isPostLinkedChanges,
};
