const R = require('ramda');
const names = require('ru-names');

/* spell-checker: disable */
const dict = Object.freeze({
    comment_created: 'добавил%{f} комментарий',
    comment_updated: 'изменил%{f} комментарий',
    issue_updated: 'изменил%{f} задачу',
    issueHasChanged: 'Задача изменена',
    statusHasChanged: '%{issue.key} "%{issue.fields.summary}" теперь в статусе "%{status}"',
    statusHasChangedMessage: '%{user.name} изменил%{f} статус связанной задачи [%{issue.key} "%{issue.fields.summary}"](%{issue.ref}) на **%{status}**',
    newIssueInEpic: 'Новая задача в эпике',
    issueAddedToEpic: 'К эпику добавлена задача [%{issue.key} %{issue.fields.summary}](%{issue.ref})',
    newLink: 'Новый линк',
    newLinkMessage: 'Новая связь, эта задача **%{relation}** [%{key} "%{summary}"](%{ref})',
    miss: 'отсутствует',
    epicAddedToProject: 'К проекту добавлен эпик [%{issue.key} %{issue.fields.summary}](%{issue.ref})',
    newEpicInProject: 'Новый эпик в проекте',
    statusEpicChanged: 'Эпик изменён',
    statusEpicChangedMessage: '%{user.name} изменил%{f} статус связанного эпика [%{issue.key} "%{issue.fields.summary}"](%{issue.ref}) на **%{status}**',
    errorMatrixCommands: 'Что-то пошло не так! Ваш запрос не выполнен, пожалуйста, попробуйте еще раз',
    errorMatrixAssign: 'ОШИБКА! Пользователь "%{assignee}" не существует',
    successMatrixAssign: 'Пользователь %{assignee} назначен исполнителем задачи',
    errorMatrixComment: 'Что-то пошло не так! Комментарий не опубликован',
    successMatrixComment: 'Комментарий опубликован',
    listJiraCommand: 'Список доступных команд',
    errorMoveJira: 'ОШИБКА! Статус задачи не изменен<br>Попробуйте еще раз',
    successMoveJira: 'Статус задачи обновлен',
});
/* spell-checker: enable */

function getGenderVerbEnding(fullName) {
    const getGender = R.pipe(
        R.split(/\s+/),
        R.map(R.pipe(R.trim, R.toLower)),
        R.reduce((result, part) => {
            const gender = names[part];
            return gender ? R.reduced(gender) : undefined;
        }, undefined)
    );
    return R.pipe(
        R.ifElse(R.is(String), getGender, R.always(undefined)),
        R.prop(R.__, {m: '', f: 'а'}),
        R.defaultTo('(а)')
    )(fullName);
}

function tValues(values, personName) {
    const ending = getGenderVerbEnding(personName);
    return R.assoc('f', ending, values);
}

module.exports.dict = dict;
module.exports.tValues = tValues;
