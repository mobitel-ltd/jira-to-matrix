const Ramda = require('ramda');
const conf = require('../config');
const logger = require('../modules/log.js')(module);

const REDIS_ROOM_KEY = 'newrooms';
// TODO: change until start correct bot work
const ROOMS_OLD_NAME = 'rooms';
// It helps ignore keys for links epic--issue
const DELIMITER = '|';
const KEYS_TO_IGNORE = [ROOMS_OLD_NAME, DELIMITER];
const [COMMON_NAME] = conf.matrix.domain.split('.').slice(1, 2);

const utils = {
    // Comment data
    getCommentEvent: ({webhookEvent}) => {
        const isCommentHook = Ramda.contains(Ramda.__, ['comment_created', 'comment_updated']);

        return isCommentHook(webhookEvent) ? webhookEvent : 'comment_created';
    },

    getFullName: body => Ramda.path(['comment', 'author', 'displayName'], body),

    getProjectOpts: body => Ramda.path(['issue', 'fields', 'project'], body),

    getStatus: body => Ramda.path(['issue', 'fields', 'status', 'name'], body),

    getUserName: body => Ramda.path(['issue', 'user', 'name'], body),

    getId: body => Ramda.path(['issue', 'id'], body),

    getKey: body => Ramda.path(['issue', 'key'], body),

    getWatchersPath: baseUrl => [baseUrl, 'watchers'].join('/'),

    getBodyIssueLink: body => Ramda.path(['issue', 'self']),

    getLinks: body => Ramda.path(['issue', 'fields', 'issuelinks'], body),

    getSummary: body => Ramda.path(['issue', 'fields', 'summary'], body),

    getAuthor: body => Ramda.path(['comment', 'author', 'name'], body),

    getBodyTimestamp: body => Ramda.path(['timestamp'], body),

    getBodyWebhookEvent: body => Ramda.path(['webhookEvent'], body),

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
        return Ramda.pathOr(utils.getWatchersPath(selfLink), ['fields', 'watches', 'self'], body);
    },

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
        const json = JSON.stringify(body);
        const matches = /\/issue\/(\d+)\//.exec(json);
        if (!matches) {
            logger.warn('matches from jira.issue.extractID is not defained');
            return;
        }
        return matches[1];
    },

    isCommentEvent: ({webhookEvent, issue_event_type_name: issueEventTypeName}) => {
        const propNotIn = Ramda.complement(utils.propIn);
        return Ramda.anyPass([
            utils.propIn('webhookEvent', ['comment_created', 'comment_updated']),
            Ramda.allPass([
                Ramda.propEq('webhookEvent', 'jira:issue_updated'),
                propNotIn('issueEventTypeName', ['issue_commented', 'issue_comment_edited']),
            ]),
        ])({webhookEvent, issueEventTypeName} || {});
    },
};

module.exports = {
    JIRA_REST: 'rest/api/2',
    REDIS_ROOM_KEY,
    COMMON_NAME,
    ...utils,
};
