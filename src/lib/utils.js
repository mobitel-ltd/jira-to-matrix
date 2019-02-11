const translate = require('../locales');
const Ramda = require('ramda');
const {jira, features, matrix} = require('../config');
const {epicUpdates, postChangesToLinks} = features;
const messages = require('./messages');

const {field: epicField} = epicUpdates;
const {url: jiraUrl} = jira;
const {userId: botId} = matrix;

const REDIS_ROOM_KEY = 'newrooms';
// TODO: change until start correct bot work
const ROOMS_OLD_NAME = 'rooms';
const REDIS_LINK_PREFIX = 'link';
const REDIS_EPIC_PREFIX = 'epic';

const DELIMITER = '|';
const KEYS_TO_IGNORE = [ROOMS_OLD_NAME, DELIMITER];
const [COMMON_NAME] = matrix.domain.split('.').slice(1, 2);
const JIRA_REST = 'rest/api/2';

const INDENT = '&nbsp;&nbsp;&nbsp;&nbsp;';
const LINE_BREAKE_TAG = '<br>';

const NEW_YEAR_2018 = new Date(Date.UTC(2018, 0, 1, 3));

const getIdFromUrl = url => {
    const [res] = url.split('/').reverse().slice(2, 3);
    return res;
};

const hooks = {
    project: {
        getIssueKey: () => false,
        getIssueId: () => false,
        getProjectKey: body => Ramda.path(['project', 'key'], body),
        getCreator: body => Ramda.path(['project', 'projectLead', 'name'], body),
        getBodyName: body => hooks.project.getProjectKey(body),
        getMembers: body => [hooks.project.getCreator(body)],
    },
    issue: {
        getSummary: body => Ramda.path(['issue', 'fields', 'summary'], body),
        getUserName: body => Ramda.path(['user', 'name'], body),
        getEpicKey: body => Ramda.path(['issue', 'fields', epicField], body),
        getType: body => Ramda.path(['issue', 'fields', 'issuetype', 'name'], body),
        getIssueId: body => Ramda.path(['issue', 'id'], body),
        getIssueKey: body => Ramda.path(['issue', 'key'], body),
        getCreator: body => Ramda.path(['issue', 'fields', 'creator', 'name'], body),
        getReporter: body => Ramda.path(['issue', 'fields', 'reporter', 'name'], body),
        getAssignee: body => Ramda.path(['issue', 'fields', 'assignee', 'name'], body),
        getMembers: body => ['getReporter', 'getCreator', 'getAssignee'].map(func => hooks.issue[func](body)),
        getChangelog: body => Ramda.path(['issue', 'changelog'], body),
        getHookChangelog: body => Ramda.path(['changelog'], body),
        getProject: body => Ramda.path(['issue', 'fields', 'project'], body),
        getProjectKey: body => Ramda.path(['key'], hooks.issue.getProject(body)),
        getBodyName: body => hooks.issue.getIssueKey(body),
        getLinks: body => Ramda.path(['issue', 'fields', 'issuelinks'], body),
    },
    comment: {
        // getIssueKey: () => false,
        getComment: body => Ramda.path(['comment'], body),
        getFullName: body => Ramda.path(['comment', 'author', 'displayName'], body),
        getAuthor: body => Ramda.path(['comment', 'author', 'name'], body),
        getUpdateAuthor: body => Ramda.path(['comment', 'updateAuthor', 'name'], body),
        getCreator: body => hooks.comment.getUpdateAuthor(body) || hooks.comment.getAuthor(body),
        getUrl: body => Ramda.path(['comment', 'self'], body),
        getIssueId: body => getIdFromUrl(hooks.comment.getUrl(body)),
        getBodyName: body => hooks.comment.getIssueId(body),
        getCommentBody: body => ({
            body: Ramda.path(['comment', 'body'], body),
            id: Ramda.path(['comment', 'id'], body),
        }),
    },
    issuelink: {
        // getIssueKey: () => false,
        // getIssueId: () => false,
        getLinks: body => [Ramda.path(['issueLink'], body)],
        getBodyName: body => Ramda.path(['issueLink', 'id'], body),
        getIssueLinkSourceId: body => Ramda.path(['issueLink', 'sourceIssueId'], body),
        getIssueLinkDestinationId: body => Ramda.path(['issueLink', 'destinationIssueId'], body),
        getSourceRelation: body => Ramda.path(['issueLink', 'issueLinkType', 'outwardName'], body),
        getDestinationRelation: body => Ramda.path(['issueLink', 'issueLinkType', 'inwardName'], body),
    },
};

const utils = {
    // * ----------------------- Webhook selectors ------------------------- *

    getHookType: body => {
        const eventType = utils.getTypeEvent(body);
        if (eventType) {
            return 'issue';
        }

        const [type] = utils.getBodyWebhookEvent(body).split('_');

        return type;
    },

    getIssueId: body => hooks[utils.getHookType(body)].getIssueId(body),

    getIssueKey: body => hooks[utils.getHookType(body)].getIssueKey(body),

    getBodyIssueName: body => hooks[utils.getHookType(body)].getBodyName(body),

    getCreator: body => hooks[utils.getHookType(body)].getCreator(body),

    getTypeEvent: body => Ramda.path(['issue_event_type_name'], body),

    getProjectKey: body => hooks[utils.getHookType(body)].getProjectKey(body),

    getChangelog: body => {
        const type = hooks[utils.getHookType(body)];

        return type.getChangelog(body) || type.getHookChangelog(body);
    },

    getCommentAuthor: body => hooks.comment.getAuthor(body),

    getComment: body => hooks.comment.getComment(body),

    getCommentBody: body => hooks.comment.getCommentBody(body),

    getUserName: body => hooks.issue.getUserName(body),

    getEpicKey: body => hooks.issue.getEpicKey(body),

    getKey: body => hooks.issue.getIssueKey(body) || Ramda.path(['key'], body),

    getLinks: body => hooks[utils.getHookType(body)].getLinks(body),

    getIssueLinkSourceId: body => hooks.issuelink.getIssueLinkSourceId(body),

    getIssueLinkDestinationId: body => hooks.issuelink.getIssueLinkDestinationId(body),

    getSourceRelation: body => hooks.issuelink.getSourceRelation(body),

    getDestinationRelation: body => hooks.issuelink.getDestinationRelation(body),

    getSummary: body => hooks.issue.getSummary(body) || utils.getResponcedSummary(body),

    getBodyTimestamp: body => Ramda.path(['timestamp'], body),

    getBodyWebhookEvent: body => Ramda.path(['webhookEvent'], body),

    getHookUserName: body => utils.getCommentAuthor(body) || utils.getUserName(body),

    getChangelogItems: body => Ramda.pathOr([], ['items'], utils.getChangelog(body)),

    isCorrectWebhook: (body, hookName) => utils.getBodyWebhookEvent(body) === hookName,

    isEpic: body => hooks.issue.getType(body) === 'Epic',

    isCommentEvent: body =>
        utils.getHookType(body) === 'comment' && !utils.getBodyWebhookEvent(body).includes('deleted'),

    /**
     * Get changelog field body from webhook from jira
     * @param {string} fieldName key of changelog field
     * @param {object} body webhook body
     * @return {object} changelog field
     */
    getChangelogField: (fieldName, body) => utils
        .getChangelogItems(body)
        .find(item => item.field === fieldName),

    getNewStatus: body => Ramda.path(['toString'], utils.getChangelogField('status', body)),

    getRelations: issueLinkBody => ({
        inward: {relation: Ramda.path(['type', 'inward'], issueLinkBody), related: issueLinkBody.inwardIssue},
        outward: {relation: Ramda.path(['type', 'outward'], issueLinkBody), related: issueLinkBody.outwardIssue},
    }),

    getDescriptionFields: body => ({
        assigneeName: utils.getTextIssue(body, 'assignee.displayName'),
        assigneeEmail: utils.getTextIssue(body, 'assignee.emailAddress'),
        reporterName: utils.getTextIssue(body, 'reporter.displayName'),
        reporterEmail: utils.getTextIssue(body, 'reporter.emailAddress'),
        typeName: utils.getTextIssue(body, 'issuetype.name'),
        epicLink: utils.getTextIssue(body, 'customfield_10006'),
        estimateTime: utils.getTextIssue(body, 'timetracking.originalEstimate'),
        description: utils.getTextIssue(body, 'description'),
        priority: utils.getTextIssue(body, 'priority.name'),
    }),

    getHeaderText: body => {
        const name = hooks.comment.getFullName(body);
        const eventName = utils.getBodyWebhookEvent(body);

        return translate(eventName, {name});
    },

    getIssueMembers: body =>
        [...new Set(hooks[utils.getHookType(body)].getMembers(body))].filter(Boolean),

    getTextIssue: (body, path) => {
        const params = path.split('.');
        const text = String(
            Ramda.path(['issue', 'fields', ...params], body) || translate('miss')
        ).trim();

        return text;
    },

    getLinkKeys: body => {
        const links = utils.getLinks(body);

        return links.reduce((acc, link) => {
            const destIssue = Ramda.either(
                Ramda.prop('outwardIssue'),
                Ramda.prop('inwardIssue')
            )(link);

            const destStatusCat = Ramda.path(['fields', 'status', 'statusCategory', 'id'], destIssue);
            if (postChangesToLinks.ignoreDestStatusCat.includes(destStatusCat)) {
                return acc;
            }
            return [...acc, destIssue.key];
        }, []);
    },

    // * ------------------------- Request selectors ------------------------- *

    getProjectPrivateStatus: body => Ramda.path(['isPrivate'], body),

    getProjectStyle: body => Ramda.path(['style'], body),

    isNewGenProjectStyle: body => utils.getProjectStyle(body) === 'new-gen',

    isIgnoreProject: body => utils.isNewGenProjectStyle(body) && utils.getProjectPrivateStatus(body),

    getResponcedSummary: body => Ramda.path(['fields', 'summary'], body),

    getInwardLinkKey: body => Ramda.path(['inwardIssue', 'key'], body),

    getOutwardLinkKey: body => Ramda.path(['outwardIssue', 'key'], body),

    // * --------------------------------- Redis utils ------------------------------- *

    getRedisLinkKey: id => [REDIS_LINK_PREFIX, DELIMITER, id].join(''),

    getRedisEpicKey: id => [REDIS_EPIC_PREFIX, DELIMITER, id].join(''),

    getRedisKey: (funcName, body) => [funcName, utils.getBodyTimestamp(body)].join('_'),

    isIgnoreKey: key => !KEYS_TO_IGNORE.some(val => key.includes(val)),

    // * --------------------------------- Error handling ---------------------------- *

    getDefaultErrorLog: funcName => `Error in ${funcName}`,

    errorTracing: (name, err) => {
        const log = messages[name] || utils.getDefaultErrorLog(name);

        return [log, err].join('\n');
    },

    // * --------------------------------- Request utils ------------------------------- *

    auth: () => {
        const {user, password} = jira;
        const encoded = Buffer.from(`${user}:${password}`).toString('base64');

        return `Basic ${encoded}`;
    },

    getRestUrl: (...args) => [jiraUrl, JIRA_REST, ...args].join('/'),

    getViewUrl: (key, type = 'browse') => [jiraUrl, type, key].join('/'),

    // * --------------------------------- Matrix utils ------------------------------- *

    isAdmin: user => matrix.admins.includes(user),


    isMatrixRoomName: room => ~room.indexOf(matrix.domain),

    getMatrixRoomAlias: alias => `#${alias}:${matrix.domain}`,

    getMatrixUserID: shortName => `@${shortName}:${matrix.domain}`,

    getNameFromMatrixId: id => {
        const [name] = id.split(':').slice(0, 1);

        return name.slice(1);
    },
    getMembersExceptBot: joinedMembers =>
        joinedMembers.reduce((acc, {userId}) =>
            (userId === botId ? acc : [...acc, userId]), []),

    // * --------------------------------- Other utils ------------------------------- *

    getProjectKeyFromIssueKey: issueKey => issueKey.split('-').slice(0, 1),
    getCommandAction: (val, collection) =>
        collection.find(({id, name}) => id === val || name.toLowerCase() === val.toLowerCase()),

    getLimit: () => NEW_YEAR_2018.getTime(),


    getListToHTML: list => list.reduce((acc, {name, displayName}) =>
        `${acc}<strong>${name}</strong> - ${displayName}<br>`,
    `${translate('listUsers')}:<br>`),

    getCommandList: list => list.reduce((acc, {name, id}) =>
        `${acc}<strong>${id})</strong> - ${name}<br>`,
    `${translate('listJiraCommand')}:<br>`),

    expandParams: {expand: 'renderedFields'},

    propIn: Ramda.curry((prop, arr, obj) =>
        Ramda.or(arr, [])
            .includes(Ramda.or(obj, {})[prop])
    ),

    nonEmptyString: Ramda.both(
        Ramda.is(String),
        Ramda.complement(Ramda.isEmpty)
    ),

    composeRoomName: ({key, summary}) => `${key} ${summary}`,

    getClosedDescriptionBlock: data => [utils.getOpenedDescriptionBlock(data), LINE_BREAKE_TAG].join(''),

    getOpenedDescriptionBlock: data => [LINE_BREAKE_TAG, INDENT, data].join(''),
};

module.exports = {
    INDENT,
    REDIS_ROOM_KEY,
    COMMON_NAME,
    ...utils,
};
