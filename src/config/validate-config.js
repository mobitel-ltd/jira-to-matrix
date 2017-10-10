const J = require('joi');
const logger = require('simple-color-logger')();

const int = J.number().integer().required();
const string = J.string().required();
const boolean = J.boolean().required();
const address = [string.uri(), string.ip()];
const obj = fields => J.object(fields).required();
const array = itemsType => J.array().items(itemsType);

const schema = obj({
    port: int,
    lang: ['en', 'ru'],
    jira: obj({
        url: address,
        user: string,
        password: string,
    }),
    features: obj({
        createRoom: boolean,
        inviteNewMembers: boolean,
        postComments: boolean,
        postIssueUpdates: boolean,
        epicUpdates: obj({
            newIssuesInEpic: ['on', 'off'],
            issuesStatusChanged: ['on', 'off'],
            field: string,
            fieldAlias: string,
        }),
        newLinks: boolean,
        postChangesToLinks: obj({
            on: boolean,
            // Not to post to closed issues (3 - id of status category "Done")
            ignoreDestStatusCat: array(J.number().integer()),
        }),
    }),
    usersToIgnore: array(J.string()),
    testMode: obj({
        on: boolean,
        users: array(J.string()),
    }),
    redis: obj({
        host: string,
        port: int,
        prefix: string,
        ttl: int,
    }),
    ttm_minutes: int,
    matrix: obj({
        admins: array(J.string()),
        domain: string,
        user: string,
        password: string,
        tokenTTL: int,
        syncTimeoutSec: int,
    }),
});

/**
 * @param {Object} config Config object for validation
 * @returns {boolean} TRUE if config valid, else FALSE
 */
const validate = function validate(config) {
    const options = {
        abortEarly: false,
        convert: false,
    };
    const {error} = J.validate(config, schema, options);
    if (error) {
        logger.error('Config is invalid:');
        error.details.forEach(detail => {
            logger.error(`  - ${detail.path}: ${detail.message}`);
        });
        return false;
    }
    return true;
};

module.exports = validate;
