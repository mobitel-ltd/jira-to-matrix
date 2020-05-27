import * as parsers from './parse-body';
import * as utils from '../../../lib/utils';
import { config } from '../../../config';

const { features } = config;
export const isPostComment = body => features.postComments && utils.isCommentEvent(body) && utils.getComment(body);

export const isPostIssueUpdates = body =>
    features.postIssueUpdates && utils.isCorrectWebhook(body, 'jira:issue_updated') && utils.getChangelog(body);

export const isCreateRoom = body =>
    features.createRoom && utils.getKey(body) && utils.getTypeEvent(body) !== 'issue_moved';

export const isMemberInvite = body =>
    features.inviteNewMembers &&
    utils.isCorrectWebhook(body, 'jira:issue_updated') &&
    utils.getTypeEvent(body) !== 'issue_moved';

export const isPostEpicUpdates = body =>
    features.epicUpdates.on() &&
    (utils.isCorrectWebhook(body, 'jira:issue_updated') ||
        (utils.isCorrectWebhook(body, 'jira:issue_created') && utils.getChangelog(body))) &&
    utils.getEpicKey(body);

export const isPostProjectUpdates = body =>
    features.epicUpdates.on() &&
    (utils.isCorrectWebhook(body, 'jira:issue_updated') || utils.isCorrectWebhook(body, 'jira:issue_created')) &&
    utils.isEpic(body) &&
    (utils.getTypeEvent(body) === 'issue_generic' || utils.getTypeEvent(body) === 'issue_created');

export const isPostNewLinks = body =>
    (features.newLinks &&
        (utils.isCorrectWebhook(body, 'jira:issue_updated') || utils.isCorrectWebhook(body, 'jira:issue_created')) &&
        utils.getLinks(body).length > 0) ||
    utils.getBodyWebhookEvent(body) === 'issuelink_created';

export const isPostLinkedChanges = body =>
    features.postChangesToLinks.on &&
    utils.isCorrectWebhook(body, 'jira:issue_updated') &&
    utils.getChangelog(body) &&
    utils.getLinks(body).length > 0 &&
    typeof utils.getNewStatus(body) === 'string';

export const isDeleteLinks = body => utils.getBodyWebhookEvent(body) === 'issuelink_deleted';

export const actionFuncs = {
    postIssueUpdates: isPostIssueUpdates,
    inviteNewMembers: isMemberInvite,
    postComment: isPostComment,
    postEpicUpdates: isPostEpicUpdates,
    postProjectUpdates: isPostProjectUpdates,
    postNewLinks: isPostNewLinks,
    postLinkedChanges: isPostLinkedChanges,
    postLinksDeleted: isDeleteLinks,
};

export const getBotActions = body => Object.keys(actionFuncs).filter(key => actionFuncs[key](body));

export const getParserName = func => `get${func[0].toUpperCase()}${func.slice(1)}Data`;

export const getFuncRedisData = body => funcName => {
    const parserName = getParserName(funcName);
    const data = parsers[parserName](body);
    const redisKey = utils.getRedisKey(funcName, body);

    return { redisKey, funcName, data };
};
export const getFuncAndBody = body => {
    const botFunc = getBotActions(body);
    const createRoomData = isCreateRoom(body) && parsers.getCreateRoomData(body);
    const roomsData = { redisKey: utils.REDIS_ROOM_KEY, createRoomData };
    const funcsData = botFunc.map(getFuncRedisData(body));

    return [roomsData, ...funcsData];
};
