const R = require('ramda')
const names = require('ru-names')

/* spell-checker: disable */
const dict = Object.freeze({
    comment_created: 'добавил%{f} комментарий',
    comment_updated: 'изменил%{f} комментарий',
    issue_updated: 'изменил%{f} задачу',
    issueHasChanged: 'Задача изменена',
    statusHasChanged: '%{issue.key} "%{issue.fields.summary}" теперь в статусе "%{status}"',
    statusHasChangedMessage: '%{user.name} изменил%{f} статус задачи [%{issue.key} "%{issue.fields.summary}"](%{issue.ref}) на **%{status}**',
    newIssueInEpic: 'Новая задача в эпике',
    issueAddedToEpic: 'К эпику добавлена задача [%{issue.key} %{issue.fields.summary}](%{issue.ref})',
})
/* spell-checker: enable */

function getGenderVerbEnding(fullName) {
    const getGender = R.pipe(
        R.split(/\s+/),
        R.map(R.pipe(R.trim, R.toLower)),
        R.reduce((result, part) => {
            const gender = names[part]
            return gender ? R.reduced(gender) : undefined
        }, undefined)
    )
    return R.pipe(
        R.ifElse(R.is(String), getGender, R.always(undefined)),
        R.prop(R.__, { m: '', f: 'а' }),
        R.defaultTo('(а)')
    )(fullName)
}

function tValues(values, personName) {
    if (!personName) {
        return values
    }
    const ending = getGenderVerbEnding(personName)
    return R.assoc('f', ending, values)
}

module.exports.dict = dict
module.exports.tValues = tValues
