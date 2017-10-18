const Ramda = require('ramda');
const {fp} = require('../utils');
const conf = require('../config');

function auth()/* :string*/ {
    const {user, password} = conf.jira;
    const encoded = new Buffer(`${user}:${password}`).toString('base64');
    return `Basic ${encoded}`;
}

function webHookUser(hook/* :{}*/) {
    const paths = [
        ['comment', 'author', 'name'],
        ['user', 'name'],
    ];
    return Ramda.pipe(
        Ramda.map(Ramda.path(Ramda.__, hook)),
        Ramda.find(fp.nonEmptyString)
    )(paths);
}

const getChangelogField = Ramda.curry(
    (fieldName, hook) =>
        Ramda.ifElse(
            Ramda.is(Object),
            Ramda.pipe(
                Ramda.pathOr([], ['changelog', 'items']),
                Ramda.find(Ramda.propEq('field', fieldName))
            ),
            Ramda.always(undefined)
        )(hook)
);

module.exports = {auth, webHookUser, getChangelogField};
