/* eslint-disable camelcase, no-undefined, id-length */
const Ramda = require('ramda');
const names = require('ru-names');

/* spell-checker: disable */
const dict = Object.freeze({
    comment_created: 'добавил%{f} комментарий',
    comment_updated: 'изменил%{f} комментарий',
    issue_updated: 'изменил%{f} задачу',
    issueHasChanged: 'Задача изменена',
    statusHasChanged: '%{key} "%{summary}" теперь в статусе "%{status}"',
    statusHasChangedMessage: '%{name} изменил%{f} статус связанной задачи [%{key} "%{summary}"](%{issueRef}) на **%{status}**',
    newIssueInEpic: 'Новая задача в эпике',
    issueAddedToEpic: 'К эпику добавлена задача [%{key} %{summary}](%{issueRef})',
    newLink: 'Новый линк',
    newLinkMessage: 'Новая связь, эта задача **%{relation}** [%{key} "%{summary}"](%{issueRef})',
    deleteLink: 'Связь удалена',
    deleteLinkMessage: 'Связь удалена, эта задача **%{relation}** [%{key} "%{summary}"](%{issueRef})',
    miss: 'отсутствует',
    epicAddedToProject: 'К проекту добавлен эпик [%{key} %{summary}](%{issueRef})',
    newEpicInProject: 'Новый эпик в проекте',
    statusEpicChanged: 'Эпик изменён',
    statusEpicChangedMessage: '%{name} изменил%{f} статус связанного эпика [%{key} "%{summary}"](%{issueRef}) на **%{status}**',
    errorMatrixCommands: 'Что-то пошло не так! Ваш запрос не выполнен, пожалуйста, попробуйте еще раз',
    errorMatrixAssign: 'ОШИБКА! Пользователь "%{userToFind}" не существует',
    successMatrixInvite: 'Успешно приглашен',
    errorMatrixInvite: 'Ошибка при присоединение к комнате',
    successMatrixAssign: 'Пользователь "%{displayName}" назначен исполнителем задачи',
    errorMatrixComment: 'Что-то пошло не так! Комментарий не опубликован',
    successMatrixComment: 'Комментарий опубликован',
    listJiraCommand: 'Список доступных команд',
    errorMoveJira: 'ОШИБКА! Статус задачи не изменен<br>Попробуйте еще раз',
    successMoveJira: 'Статус задачи изменён на %{name}',
    errorWatcherJira: 'Наблюдатель не добавлен! Проверьте имя пользователя и попробуйте еще раз',
    successWatcherJira: 'Наблюдатель добавлен',
    notFoundUser: 'Пользователь не найден',
    setPriority: 'Теперь задача имеет приоритет %{name}',
    rightsError: 'У вас нет прав на это действие',
    successUserKick: 'Пользователь %{user} исключен из комнаты %{roomName}',
    errorUserKick: 'Ошибка при попытки исключения пользователя %{user} из комнаты %{roomName}',
    kickInfo: 'Пользователь %{sender} попытался исключить следующих пользователей из комнат:',
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

module.exports = {dict, tValues};
