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

const isIgnoreKey = key => {
    const result = !KEYS_TO_IGNORE.reduce((acc, val) => {
        const result = acc || key.includes(val);
        return result;
    }, false);
    return result;
};

const propIn = Ramda.curry((prop, arr, obj) =>
    Ramda.or(arr, [])
        .includes(Ramda.or(obj, {})[prop])
);

const nonEmptyString = Ramda.both(
    Ramda.is(String),
    Ramda.complement(Ramda.isEmpty)
);

// eslint-disable-next-line no-shadow
const paths = Ramda.curry((paths, object) => Ramda.pipe(
    Ramda.map(Ramda.split('.')),
    Ramda.map(path => ({
        [path.join('.')]: Ramda.path(path, object),
    })),
    Ramda.mergeAll
)(paths));

const paramsToQueryString = params => {
    const toStrings = Ramda.map(Ramda.pipe(
        Ramda.mapObjIndexed((value, key) => `${key}=${value}`),
        Ramda.values
    ));
    return Ramda.ifElse(
        Ramda.isEmpty,
        Ramda.always(''),
        Ramda.pipe(toStrings, Ramda.join('&'), Ramda.concat('?'))
    )(params || []);
};

const auth = () => {
    const {user, password} = conf.jira;
    const encoded = Buffer.from(`${user}:${password}`).toString('base64');
    return `Basic ${encoded}`;
};

/**
 * Get author of webhook from jira
 * @param {object} hook webhook body
 * @return {string} username
 */
const webHookUser = hook => {
    const paths = [
        ['comment', 'author', 'name'],
        ['user', 'name'],
    ];
    return Ramda.pipe(
        Ramda.map(Ramda.path(Ramda.__, hook)),
        Ramda.find(nonEmptyString)
    )(paths);
};

/**
 * Get creator of issue in webhook from jira
 * @param {object} hook webhook body
 * @return {string} creator
 */
const getCreator = hook => {
    const path = ['issue', 'fields', 'creator', 'name'];
    return Ramda.pathOr('', path, hook);
};
/**
 * Get changelog field body from webhook from jira
 * @param {string} key key of changelog field
 * @param {object} hook webhook body
 * @return {object} changelog field
 */
const getChangelogField = Ramda.curry(
    (fieldName, hook) =>
        Ramda.ifElse(
            Ramda.is(Object),
            Ramda.pipe(
                Ramda.pathOr([], ['changelog', 'items']),
                Ramda.find(Ramda.propEq('field', fieldName))
            ),
            Ramda.always(null)
        )(hook)
);

const getNewStatus = Ramda.pipe(
    Ramda.pathOr([], ['issue', 'changelog', 'items']),
    Ramda.filter(Ramda.propEq('field', 'status')),
    Ramda.head,
    Ramda.propOr(null, 'toString')
);

const composeRoomName = issue =>
    `${issue.key} ${issue.summary}`;

/**
 * Get issue ID from jira webhook
 * @param {object} json jira webhook
 * @return {string} issue ID
 */
const extractID = json => {
    const matches = /\/issue\/(\d+)\//.exec(json);
    if (!matches) {
        logger.warn('matches from jira.issue.extractID is not defained');
        return;
    }
    return matches[1];
};

const isCommentEvent = ({webhookEvent, issue_event_type_name: issueEventTypeName}) => {
    const propNotIn = Ramda.complement(propIn);
    return Ramda.anyPass([
        propIn('webhookEvent', ['comment_created', 'comment_updated']),
        Ramda.allPass([
            Ramda.propEq('webhookEvent', 'jira:issue_updated'),
            propNotIn('issueEventTypeName', ['issue_commented', 'issue_comment_edited']),
        ]),
    ])({webhookEvent, issueEventTypeName} || {});
};

module.exports = {
    auth,
    webHookUser,
    getChangelogField,
    getCreator,
    paramsToQueryString,
    propIn,
    nonEmptyString,
    paths,
    getNewStatus,
    composeRoomName,
    extractID,
    isCommentEvent,
    REDIS_ROOM_KEY,
    isIgnoreKey,
    COMMON_NAME,
};
