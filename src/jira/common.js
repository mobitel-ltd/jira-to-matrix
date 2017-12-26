const Ramda = require('ramda');
const {fp} = require('../utils');
const conf = require('../config');

/**
 * Authorization for a request of jira
 * @return {string} Authorization in base64 encoding
 */
const auth = () => {
    const {user, password} = conf.jira;
    const encoded = new Buffer(`${user}:${password}`).toString('base64');
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
        Ramda.find(fp.nonEmptyString)
    )(paths);
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

module.exports = {auth, webHookUser, getChangelogField};
