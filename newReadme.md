## Лицензия
[wtfpl]: wtfpl-badge-1.png "WTFPL License :)"
![No WTFPL License image :(][wtfpl]

## Стек технологий
- NodeJS 7.8+ [Документация](https://nodejs.org/dist/latest-v5.x/docs/api/)
- Redis 3+ [Документация](https://redis.io/documentation)
- ES2016+
- ESLint [linting utility for JavaScript](http://eslint.org/)
- Riot [free Matrix group chat](https://about.riot.im/)
- Jira [development tool used by agile teams](https://www.atlassian.com/software/jira)

## Конфиг

В корне проекта присутствует файл config.example.js, в котором с перечислением типов данных для каждого параметра. Работа бота стрится на основе конфига, пример ниже:  
```js
{
  port: 4100, // where to listen JIRA webhooks
    lang: 'en', // a language bot talks to users in
    jira: {
        url: 'https://jira.example.org',
        user: 'bot',
        password: 'key',
    },
    // list of available actions for current user
    features: {
        createRoom: true,
        inviteNewMembers: true,
        postComments: true,
        postIssueUpdates: true,
        epicUpdates: {
            newIssuesInEpic: 'on',
            issuesStatusChanged: 'on',
            field: 'customfield_10006',
            fieldAlias: 'Epic Link',
        },
        newLinks: true,
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
        ttl: 60 * 60 * 24 * 30, // seconds (30 days here)
    },
    ttm_minutes: 60, // time-to-matter, how long to re-try digesting jira hooks
    // Matrix params
    matrix: {
        domain: 'matrix.example.org',
        user: 'bot', // short name, before colon, without @
        password: 'key',
        tokenTTL: 10 * 60, // new token request interval (10 minutes here)
        syncTimeoutSec: 20, // seconds
    },
    // log params based on winston
    log: {
        type: 'both',
        filePath: 'logs/service',
        fileLevel: 'silly',
        consoleLevel: 'debug',
    }
}
```

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

Для работы с `Riot` используется [SDK Mtrix](https://github.com/matrix-org/matrix-js-sdk). При запуске бота происходит подключение к домену матрикса (`matrix.domain` из конфига) под `userId` вида `@${config.matrix.user}:${config.matrix.domain}`. После успешной авторизации и поключення лог должен вывести сообщение вида:  
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
!assign <имя пользователя>|закрепит задачу за выбранным пользователем
!move|выводит список новых возможных состояний задачи
!move <index>/<transition>|меняет статус задачи
!spec <имя пользователя>|добавляет наблюдателя над задачей
!prio|выводит список возможных приоритетов задачи
!move <index>/<transition>|меняет приоритет задачи
!op <имя пользователя>|даёт права модератора выбранному пользователю
(admins only) !invite <название комнаты>|приглашает текущего пользователя в комнату

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
