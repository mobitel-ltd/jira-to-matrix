const translate = require('../locales');
const Ramda = require('ramda');
const logger = require('../modules/log.js')(module);
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


const utils = {
    // * ----------------------- Webhook selectors ------------------------- *
    getProjectPrivateStatus: body => Ramda.path(['isPrivate'], body),

    getProjectStyle: body => Ramda.path(['style'], body),

    getCreator: body => Ramda.path(['issue', 'fields', 'creator', 'name'], body),

    getTypeEvent: body => Ramda.path(['issue_event_type_name'], body),

    getIssueChangelog: body => Ramda.path(['issue', 'changelog'], body),

    getChangelog: body => Ramda.path(['changelog'], body),

    getComment: body => Ramda.path(['comment'], body),

    getFullName: body => Ramda.path(['comment', 'author', 'displayName'], body),

    getIssueProjectOpts: body => Ramda.path(['issue', 'fields', 'project'], body),

    getStatus: body => Ramda.path(['issue', 'fields', 'status', 'name'], body),

    getUserName: body => Ramda.path(['user', 'name'], body),

    getEpicKey: body => Ramda.path(['issue', 'fields', epicField], body),

    getIssueId: body => Ramda.path(['issue', 'id'], body),

    getKey: body => Ramda.path(['issue', 'key'], body) || Ramda.path(['key'], body),

    getInwardLinkKey: body => Ramda.path(['inwardIssue', 'key'], body),

    getOutwardLinkKey: body => Ramda.path(['outwardIssue', 'key'], body),

    getWatchersPath: baseUrl => [baseUrl, 'watchers'].join('/'),

    getBodyIssueLink: body => Ramda.path(['issue', 'self'], body),

    getProjectOpts: body => Ramda.path(['project'], body),

    getLinks: body => Ramda.pathOr([utils.getLinksIssueLink(body)], ['issue', 'fields', 'issuelinks'], body),

    getLinksIssueLink: body => Ramda.path(['issueLink'], body),

    getIssueLinkSourceId: body => Ramda.path(['sourceIssueId'], body) || Ramda.path(['sourceIssueId'], utils.getLinksIssueLink(body)),

    getIssueLinkDestinationId: body => Ramda.path(['destinationIssueId'], body) || Ramda.path(['destinationIssueId'], utils.getLinksIssueLink(body)),

    getLinksIssueIds: body => [utils.getIssueLinkSourceId(body), utils.getIssueLinkDestinationId(body)],

    getSourceRelation: body => Ramda.path(['issueLinkType', 'outwardName'], body),

    getDestinationRelation: body => Ramda.path(['issueLinkType', 'inwardName'], body),

    getSummary: body => Ramda.path(['issue', 'fields', 'summary'], body) || Ramda.path(['fields', 'summary'], body),

    getCommentAuthor: body => Ramda.path(['comment', 'author', 'name'], body),

    getBodyTimestamp: body => Ramda.path(['timestamp'], body),

    getBodyWebhookEvent: body => Ramda.path(['webhookEvent'], body),

    getIssueTypeName: body => Ramda.path(['issue', 'fields', 'issuetype', 'name'], body),

    getHookUserName: body => utils.getCommentAuthor(body) || utils.getUserName(body),

    isNewGenProjectStyle: body => utils.getProjectStyle(body) === 'new-gen',

    isLinkHook: body => {
        const hook = utils.getBodyWebhookEvent(body);

        return hook.includes('issuelink');
    },

    isCorrectWebhook: (body, hookName) => utils.getBodyWebhookEvent(body) === hookName,

    isChangelogExists: body => !(Ramda.isEmpty(Ramda.pathOr([], ['changelog', 'items'], body))),

    isEpic: body =>
        utils.getIssueTypeName(body) === 'Epic',

    isProjectEvent: body =>
        ['project_created', 'project_updated'].includes(utils.getBodyWebhookEvent(body)),

    isCommentEvent: body => {
        const webhookEvent = utils.getBodyWebhookEvent(body);
        const issueEventTypeName = utils.getTypeEvent(body);
        const propNotIn = Ramda.complement(utils.propIn);
        return Ramda.anyPass([
            utils.propIn('webhookEvent', ['comment_created', 'comment_updated']),
            Ramda.allPass([
                Ramda.propEq('webhookEvent', 'jira:issue_updated'),
                propNotIn('issueEventTypeName', ['issue_commented', 'issue_comment_edited']),
            ]),
        ])({webhookEvent, issueEventTypeName} || {});
    },

    /**
     * Get changelog field body from webhook from jira
     * @param {string} key key of changelog field
     * @param {object} hook webhook body
     * @return {object} changelog field
     */
    getChangelogField: Ramda.curry(
        (fieldName, hook) =>
            Ramda.ifElse(
                Ramda.is(Object),
                Ramda.pipe(
                    Ramda.pathOr([], ['changelog', 'items']),
                    Ramda.find(Ramda.propEq('field', fieldName))
                ),
                Ramda.always(null)
            )(hook)
    ),

    getNewStatus: body => {
        const changelog = utils.getIssueChangelog(body) || utils.getChangelog(body);
        const changelogItems = Ramda.pathOr([], ['items'], changelog);
        const statusField = changelogItems.find(({field}) => field === 'status');

        return Ramda.pathOr(null, ['toString'], statusField);
    },

    /**
     * Get issue ID from jira webhook
     * @param {object} body jira webhook
     * @return {string} issue ID
     */
    extractID: body => {
        const id = utils.getIssueId(body);
        if (id) {
            return id;
        }
        const json = JSON.stringify(body);
        const matches = /\/issue\/(\d+)\//.exec(json);
        if (!matches) {
            logger.warn('matches from jira.issue.extractID is not defined');
            return;
        }
        return matches[1];
    },

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

    getCreateProjectOpts: body => {
        if (utils.isEpic(body) || utils.isProjectEvent(body)) {
            return utils.getProjectOpts(body) || utils.getIssueProjectOpts(body);
        }
    },


    getHeaderText: body => {
        const fullName = utils.getFullName(body);
        const event = utils.getBodyWebhookEvent(body);

        return `${fullName} ${translate(event, null, fullName)}`;
    },

    getCommentBody: body => ({
        body: Ramda.path(['comment', 'body'], body),
        id: Ramda.path(['comment', 'id'], body),
    }),

    // ! It's not needed now
    // getRenderedFieldEpicName: (renderedIssue, epicLink) => {
    //     const renderedField = Ramda.path(['renderedFields', 'customfield_10005'], renderedIssue);
    //     const fields = Ramda.path(['fields', 'customfield_10005'], renderedIssue);

    //     return String(renderedField || fields || epicLink);
    // },

    getBodyIssueName: body =>
        Ramda.pathOr(Ramda.path(['key'], body), ['issue', 'key'], body) || utils.extractID(body),

    getBodyProjectId: body =>
        Ramda.pathOr(Ramda.path(['fields', 'project', 'id'], body), ['issue', 'fields', 'project', 'id'], body),

    getIssueMembers: body => [
        utils.getCreator(body),
        Ramda.path(['issue', 'fields', 'reporter', 'name'], body),
        Ramda.path(['issue', 'fields', 'assignee', 'name'], body),
    ].filter(Boolean),

    getWatchersUrl: body => {
        const selfLink = utils.getBodyIssueLink(body);
        const watcherPath = utils.getWatchersPath(selfLink);
        return Ramda.pathOr(watcherPath, ['issue', 'fields', 'watches', 'self'], body);
    },

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
            if (!destIssue) {
                return acc;
            }
            const destStatusCat = Ramda.path(['fields', 'status', 'statusCategory', 'id'], destIssue);
            if (postChangesToLinks.ignoreDestStatusCat.includes(destStatusCat)) {
                return acc;
            }
            return [...acc, destIssue.key];
        }, []);
    },

    getProjectKeyFromIssueKey: issueKey => issueKey.split('-').slice(0, 1),

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

    // * --------------------------------- Other utils ------------------------------- *

    getCommandAction: (val, collection) =>
        collection.find(({id, name}) => id === val || name.toLowerCase() === val.toLowerCase()),

    getEvent: content => ({
        getType: () => 'm.room.power_levels',
        getContent: () => content,
    }),

    isAdmin: user => matrix.admins.includes(user),

    getLimit: () => NEW_YEAR_2018.getTime(),

    getMembersExceptBot: joinedMembers =>
        joinedMembers.reduce((acc, {userId}) =>
            (userId === botId ? acc : [...acc, userId]), []),

    isMatrixRoomName: room => ~room.indexOf(matrix.domain),

    getMatrixRoomAlias: alias => `#${alias}:${matrix.domain}`,

    getMatrixUserID: shortName => `@${shortName}:${matrix.domain}`,

    getNameFromMatrixId: id => {
        const [name] = id.split(':').slice(0, 1);

        return name.slice(1);
    },

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

    composeRoomName: issue => `${issue.key} ${issue.summary}`,

    infoBody: `
    <br>
    Use <font color="green"><strong>!help</strong></font> in chat for give info for jira commands
    `,

    getClosedDescriptionBlock: data => [utils.getOpenedDescriptionBlock(data), LINE_BREAKE_TAG].join(''),

    getOpenedDescriptionBlock: data => [LINE_BREAKE_TAG, INDENT, data].join(''),
};

module.exports = {
    INDENT,
    JIRA_REST,
    REDIS_ROOM_KEY,
    COMMON_NAME,
    ...utils,
};
