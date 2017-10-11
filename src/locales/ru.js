/* eslint-disable camelcase, no-undefined, id-length */
const Ramda = require('ramda');
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
    errorWatcherJira: 'Наблюдатель не добавлен! Проверьте имени пользователя и попробуйте еще раз',
    successWatcherJira: 'Наблюдатель добавлен',
    notFoundUser: 'Пользователь не найден',
});
/* spell-checker: enable */

const getGenderVerbEnding = function getGenderVerbEnding(fullName) {
    const getGender = Ramda.pipe(
        Ramda.split(/\s+/),
        Ramda.map(Ramda.pipe(Ramda.trim, Ramda.toLower)),
        Ramda.reduce((result, part) => {
            const gender = names[part];
            return gender ? Ramda.reduced(gender) : undefined;
        }, undefined)
    );
    return Ramda.pipe(
        Ramda.ifElse(Ramda.is(String), getGender, Ramda.always(undefined)),
        Ramda.prop(Ramda.__, {m: '', f: 'а'}),
        Ramda.defaultTo('(а)')
    )(fullName);
};

const tValues = function tValues(values, personName) {
    const ending = getGenderVerbEnding(personName);
    return Ramda.assoc('f', ending, values);
};

module.exports.dict = dict;
module.exports.tValues = tValues;
