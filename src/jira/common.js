const R = require('ramda')
const { fp } = require('../utils')
const conf = require('../config')

function auth()/*:string*/ {
    const { user, password } = conf.jira
    const encoded = new Buffer(`${user}:${password}`).toString('base64')
    return `Basic ${encoded}`
}

function webHookUser(hook/*:{}*/) {
    const paths = [
    ['comment', 'author', 'name'],
    ['user', 'name'],
    ]
    return R.pipe(
    R.map(R.path(R.__, hook)),
    R.find(fp.nonEmptyString)
  )(paths)
}

const getChangelogField = R.curry(
  (fieldName, hook) =>
    R.ifElse(
      R.is(Object),
      R.pipe(
        R.pathOr([], ['changelog', 'items']),
        R.find(R.propEq('field', fieldName))
      ),
      R.always(undefined)
    )(hook)
)

module.exports = { auth, webHookUser, getChangelogField }
