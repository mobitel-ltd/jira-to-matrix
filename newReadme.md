# JIRA to Matrix bot  

A bot (web-service) which:

* listens to JIRA Webhooks and sends some stuff to Matrix;
* use command from Matrix Riot to integrate with Jira and make different actions.

## Особенности
+ Создает комнату для каждой новой задачи;
+ Приглашает новых участников в комнату;
+ Информирует о любых изменениях задач в комнату;
+ Переименовывает в соответствующее название комнату, если задача переведена в другой проект;
+ Добавляет новые ссылки на связанные комнаты. Сигнализирует, когда статус связанной задачи изменен.
+ Поддерживает только русский и английский языки (легко расширяемо, смотри `src/locales`).

## Стек технологий
- NodeJS 7.8+ [Документация](https://nodejs.org/dist/latest-v5.x/docs/api/)
- Redis 3+ [Документация](https://redis.io/documentation)
- ES2016+
- ESLint [linting utility for JavaScript](http://eslint.org/)
- Riot [free Matrix group chat](https://about.riot.im/)
- Jira [development tool used by agile teams](https://www.atlassian.com/software/jira)

## Установка и запуск
1. [Сохранените](https://help.github.com/articles/cloning-a-repository/) данный репозиторий.
2. Зайдите в директорию, содержащую `package.json` данного проекта и запутите команду `npm install`. [Подробнее](https://docs.npmjs.com/cli/install).
3. Убедитесь, что конфиг сформирован верно, Redis, Jira и Riot работают. 
4. Зайдите в директорию, содержащую `package.json` данного проекта и запутите команду `npm run start`. Это начинает работу бота.

## Конфиг

Работа бота стрится на основе конфига, пример ниже:  
```js
{
      // where to listen JIRA webhooks
    port: 4100,
     // a language bot talks to users in
    lang: 'en',
    // jira params
    jira: {
        // url of your jira 
        url: 'https://jira.example.org',
        // jira user name
        user: 'bot',
        // user password
        password: 'key',
    },
    // list of available actions for current user
    features: {
        // create room
        createRoom: true,
        // invite new member in room
        inviteNewMembers: true,
        // post comment in Riot
        postComments: true,
        // create/update issue in jira and associated room in Riot
        postIssueUpdates: true,
        // create/update epic in jira and associated room in Riot
        epicUpdates: {
            newIssuesInEpic: 'on',
            issuesStatusChanged: 'on',
            field: 'customfield_10006',
            fieldAlias: 'Epic Link',
        },
        // create new associated in Riot with other rooms (issue in Jira)
        newLinks: true,
        // update links in Riot with other rooms (issue in Jira)
        postChangesToLinks: {
            on: true,
            // Not to post to closed issues (3 - id of status category "Done")
            ignoreDestStatusCat: [3],
        },
    },
    // useful for testing, add a test user into production config
    usersToIgnore: ['jira_test'],
    testMode: {
        on: true,
        users: ['ivan', 'masha'],
    },
    // redis params
    redis: {
        host: '127.0.0.1',
        port: 6379,
        prefix: 'jira-hooks:',
    },
    // Matrix params
    matrix: {
        // domain name of your Matrix server
        domain: 'matrix.example.org',
        // short name, before colomn, without @
        user: 'bot',
        password: 'key',
    },
    // log params based on winston https://github.com/winstonjs/winston
    log: {
        // type of log output
        type: 'both',
        // path to log file
        filePath: 'logs/service',
        // log level saved in file
        fileLevel: 'silly',
        // log level in console
        consoleLevel: 'debug',
    }
}
```
`src/config/validate-config.js` содержит файл с перечислением валидных типов данных для каждого параметра. 

## Описание работы

После запуска на сервере бот отслеживает получаемые от Jira [вебхуки](https://developer.atlassian.com/jiradev/jira-apis/webhooks).   

В случае какого-либо действия на сервере Jira, указанного в конфиге `jira.url`, будет отправлен вебхук, тело которого парсит бот и, если пользователь, который произвел действие, не в списке исключений (`usersToIgnore`), сохраняет в Redis массив доступных для пользователя действий с соответствующими данными для исполнения, полученными из тела вебхука. Если автор вебхука всё же в списке `userIgnore`, то в логе можно увидеть:
```
User "<имя_пользователя>" ignored status: true
Error in parsing  User ignored
```

Данные из Redis обрабатываются в 3 случаях:  
1. После запуска бота при наличии данных в Redis.
2. После сохранения новых данных от вебхука в Redis.
3. Каждые 15 минут после старта при наличие данных Redis (отработка невыполненных действий, заблокированных по разным причинам).

После обработки данных из Redis будет выведен лог с результатом обработки каждой записи в формате:  
```
Result of handling redis key <redisKey> --- <true/false>
```
В случае успешной обработки `redisKey` удаляется из Redis, если результат отрицательный, то запись останется и будет использоваться в следующей обработке. Это позволит использовать полученные от Jira данные в случае, к примеру, проблем со стороны матрикса при отправке на него сообщений.

### Matrix client

Для работы с `Riot` используется [SDK Matrix](https://github.com/matrix-org/matrix-js-sdk). При запуске бота происходит подключение к домену матрикса (`matrix.domain` из конфига) под `userId` вида `@${config.matrix.user}:${config.matrix.domain}`. После успешной авторизации и поключення лог должен вывести сообщение вида:  
```
createClient OK BaseUrl: https://<домен>, userId: @<имя_пользователя>:<домен>, password: <пароль>
Started connect to matrixClient
Got push rules
well connected

```
Сообщение `Got push rules` поступает от матрикса и свидетельствует о синхронизации и переходе в рабочее состояние.  
При ошибке авторизации поступает сообщение 
```
createClient error. BaseUrl: ${baseUrl}, userId: ${userId}, password: ${password}
```
После завершения работы и отключение от Riot выводится сообщение:  
```
Disconnected from Matrix
```

### Команды в Riot
Работа по отношению к `Riot` строится на основе ожидания команды и её последующей обработки. Список доступных команд:  

Команда | Описание
---|---
!help|список команд с описанием
!comment|создает комментарий в Jira issue
!assign <`имя пользователя`>|закрепит задачу за выбранным пользователем
!move|выводит список новых возможных состояний задачи
!move <`индекс задачи`>/<`статус задачи`>|меняет статус задачи
!spec <`имя пользователя`>|добавляет наблюдателя над задачей
!prio|выводит список возможных приоритетов задачи
!prio <`индекс приоритета`>/<`название приоритета`>|меняет приоритет задачи
(admins only) !op <`имя пользователя`>|даёт права модератора выбранному пользователю
(admins only) !invite <`название комнаты`>|приглашает текущего пользователя в комнату

Все эти команды доступны только в комнатах задач Jira.
Получить список команд внутри самого `Riot` можно с помощью первой команды из списка - `!help`.
В случае неверного ввода команды будет просто добавлено сообщение в текущую комнату, в логах можно увидеть предупреждение:  
```
Command <имя команды> not found
```
Для отдельных команд могут быть сообщения в `Riot` о соответствующей ошибке, к примеру при вводе неверного имени пользователя в после команды `!spec` будет сообщение:   
```
Наблюдатель не добавлен! Проверьте имени пользователя и попробуйте еще раз
```
В случае успешного ввода придет уведомление, о правильном выполнение команды.

### Структура хранения данных в Redis: 
Данные находятся в Redis под префиксом из конфига `redis.prefix`.  
Структура записи:  
* redis.key 
```
<функция-обработчик>_<jira_body_timestamp>
```
* redis.value
```
{
    funcName: <функция-обработчик>,
    data: <данные для обработчика>,
}
```

## Status
Успешно развернут в средней по велечине компании.
