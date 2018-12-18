const translate = require('../locales');
const Ramda = require('ramda');
const conf = require('../config');
const logger = require('../modules/log.js')(module);
const {jira, features} = require('../config');
const {epicUpdates, postChangesToLinks} = features;
const messages = require('./messages');

const {field: epicField} = epicUpdates;
const {url: jiraUrl} = jira;

const REDIS_ROOM_KEY = 'newrooms';
// TODO: change until start correct bot work
const ROOMS_OLD_NAME = 'rooms';

// It helps ignore keys for links epic--issue
const DELIMITER = '|';
const KEYS_TO_IGNORE = [ROOMS_OLD_NAME, DELIMITER];
const [COMMON_NAME] = conf.matrix.domain.split('.').slice(1, 2);
const JIRA_REST = 'rest/api/2';

const utils = {
    // * ----------------------- Webhook selectors ------------------------- *
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

    isCorrectWebhook: (body, hookName) => utils.getBodyWebhookEvent(body) === hookName,

    isEmptyChangelog: body => !(Ramda.isEmpty(Ramda.pathOr([], ['changelog', 'items'], body))),

    isEpic: body =>
        utils.getIssueTypeName(body) === 'Epic',

    isProjectEvent: body =>
        ['project_created', 'project_updated'].includes(utils.getBodyWebhookEvent(body)),

    getHeaderText: body => {
        const fullName = utils.getFullName(body);
        const event = utils.getBodyWebhookEvent(body);

        return `${fullName} ${translate(event, null, fullName)}`;
    },

    getTypeEvent: body => Ramda.path(['issue_event_type_name'], body),

    getIssueChangelog: body => Ramda.path(['issue', 'changelog'], body),

    getChangelog: body => Ramda.path(['changelog'], body),

    getComment: body => Ramda.path(['comment'], body),

    getCommentBody: body => ({
        body: Ramda.path(['comment', 'body'], body),
        id: Ramda.path(['comment', 'id'], body),
    }),

    getFullName: body => Ramda.path(['comment', 'author', 'displayName'], body),

    getIssueProjectOpts: body => Ramda.path(['issue', 'fields', 'project'], body),

    getStatus: body => Ramda.path(['issue', 'fields', 'status', 'name'], body),

    getUserName: body => Ramda.path(['user', 'name'], body),

    getEpicKey: body => Ramda.path(['issue', 'fields', epicField], body),

    getIssueId: body => Ramda.path(['issue', 'id'], body),

    getKey: body => Ramda.path(['issue', 'key'], body),

    getWatchersPath: baseUrl => [baseUrl, 'watchers'].join('/'),

    getBodyIssueLink: body => Ramda.path(['issue', 'self'], body),

    getProjectOpts: body => Ramda.path(['project'], body),

    getLinks: body => Ramda.pathOr(utils.getIssueCreatedLinks(body), ['issue', 'fields', 'issuelinks'], body),

    getIssueCreatedLinks: body => {
        const issueLink = Ramda.path(['issueLink'], body);

        return issueLink && [issueLink];
    },

    getSummary: body => Ramda.path(['issue', 'fields', 'summary'], body),

    getCommentAuthor: body => Ramda.path(['comment', 'author', 'name'], body),

    getBodyTimestamp: body => Ramda.path(['timestamp'], body),

    getBodyWebhookEvent: body => Ramda.path(['webhookEvent'], body),

    getIssueTypeName: body => Ramda.path(['issue', 'fields', 'issuetype', 'name'], body),

    getBodyIssueName: body =>
        Ramda.pathOr(Ramda.path(['key'], body), ['issue', 'key'], body) || utils.extractID(body),

    getBodyProjectId: body =>
        Ramda.pathOr(Ramda.path(['fields', 'project', 'id'], body), ['issue', 'fields', 'project', 'id'], body),

    getIssueMembers: body => [
        Ramda.path(['issue', 'fields', 'creator', 'name'], body),
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

    // * --------------------------------- Other utils ------------------------------- *
    issueFormatedParams: {expand: 'renderedFields'},

    getRedisKey: (funcName, body) => [funcName, utils.getBodyTimestamp(body)].join('_'),

    isIgnoreKey: key => !KEYS_TO_IGNORE.some(val => key.includes(val)),

    propIn: Ramda.curry((prop, arr, obj) =>
        Ramda.or(arr, [])
            .includes(Ramda.or(obj, {})[prop])
    ),

    nonEmptyString: Ramda.both(
        Ramda.is(String),
        Ramda.complement(Ramda.isEmpty)
    ),

    // eslint-disable-next-line no-shadow
    paths: Ramda.curry((paths, object) => Ramda.pipe(
        Ramda.map(Ramda.split('.')),
        Ramda.map(path => ({
            [path.join('.')]: Ramda.path(path, object),
        })),
        Ramda.mergeAll
    )(paths)),

    paramsToQueryString: params => {
        const toStrings = Ramda.map(Ramda.pipe(
            Ramda.mapObjIndexed((value, key) => `${key}=${value}`),
            Ramda.values
        ));
        return Ramda.ifElse(
            Ramda.isEmpty,
            Ramda.always(''),
            Ramda.pipe(toStrings, Ramda.join('&'), Ramda.concat('?'))
        )(params || []);
    },

    auth: () => {
        const {user, password} = conf.jira;
        const encoded = Buffer.from(`${user}:${password}`).toString('base64');
        return `Basic ${encoded}`;
    },

    /**
     * Get author of webhook from jira
     * @param {object} hook webhook body
     * @return {string} username
     */
    webHookUser: hook => {
        const paths = [
            ['comment', 'author', 'name'],
            ['user', 'name'],
        ];
        return Ramda.pipe(
            Ramda.map(Ramda.path(Ramda.__, hook)),
            Ramda.find(utils.nonEmptyString)
        )(paths);
    },

    /**
     * Get creator of issue in webhook from jira
     * @param {object} hook webhook body
     * @return {string} creator
     */
    getCreator: hook => {
        const path = ['issue', 'fields', 'creator', 'name'];
        return Ramda.pathOr('', path, hook);
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

    getNewStatus: Ramda.pipe(
        Ramda.pathOr([], ['issue', 'changelog', 'items']),
        Ramda.filter(Ramda.propEq('field', 'status')),
        Ramda.head,
        Ramda.propOr(null, 'toString')
    ),

    composeRoomName: issue =>
        `${issue.key} ${issue.summary}`,

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


    getRestUrl: (...args) => [jiraUrl, JIRA_REST, ...args].join('/'),

    getViewUrl: (key, type = 'browse') =>
        [jiraUrl, type, key].join('/'),

    getDefaultErrorLog: funcName => `Error in ${funcName}`,

    errorTracing: (name, err) => {
        const log = messages[name] || utils.getDefaultErrorLog(name);

        return [log, err].join('\n');
    },
};

module.exports = {
    JIRA_REST,
    REDIS_ROOM_KEY,
    COMMON_NAME,
    ...utils,
};
