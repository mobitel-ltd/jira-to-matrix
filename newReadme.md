# JIRA to Matrix bot

Бот (web-service), который:

-   следит за вебхуками от JIRA и отправляет, на основе их данные в Matrix;
-   использует команды от Matrix Riot, чтобы интегрироваться с Jira и совершить различные действия.

## Особенности

-   Создает комнату для каждой новой задачи;
-   Приглашает новых участников в комнату;
-   Информирует о любых изменениях задач в комнату;
-   Переименовывает в соответствующее название комнату, если задача переведена в другой проект;
-   Добавляет новые ссылки на связанные комнаты. Сигнализирует, когда статус связанной задачи изменен.
-   Поддерживает только русский и английский языки (легко расширяемо, смотри `src/locales`).

## Стек технологий

-   NodeJS stable [Документация](https://nodejs.org/dist/latest-v5.x/docs/api/)
-   Redis 3+ [Документация](https://redis.io/documentation)
-   ES2016+
-   ESLint [linting utility for JavaScript](http://eslint.org/)
-   Riot [free Matrix group chat](https://about.riot.im/) Далее `Riot` используется в качестве примера веб-клиента Matrix.
-   Jira [development tool used by agile teams](https://www.atlassian.com/software/jira)

## Установка и запуск

1. [Сохраните](https://help.github.com/articles/cloning-a-repository/) данный репозиторий.
2. Зайдите в директорию, содержащую `package.json` данного проекта и запутите команду `npm install`. [Подробнее](https://docs.npmjs.com/cli/install).
3. Убедитесь, что конфиг сформирован верно, Redis, Jira и Riot работают.
4. Зайдите в директорию, содержащую `package.json` данного проекта и запутите команду `npm run start`. Это начинает работу бота.

## Установка сервиса systemd в CentOS

-   Создать отдельного пользователя в системе без права входа в систему и без домашней папки (из соображений безопасности)
-   Изменить файл `jira-to-matrix.service` в соответствии с тем, куда вы установили jira-to-matrix и созданного пользователя
-   Разрешить в firewalld подключения к порту, на котором бот слушает вебхуки Jira. Разрешить прослушивать порт в SELinux
-   Скопировать файл `jira-to-matrix.service` в директорию `/etc/systemd/system/`, разрешить запускать сервис при старте системы

```bash
# Add user jira-to-matrix-bot without homedirectory and deny system login
$ sudo useradd -M jira-matrix-bot
$ sudo usermod -L jira-matrix-bot

# Change directory owner to new created user
$ chown -R jira-matrix-bot: /path/to/jira-to-matrix

# Modify service config
$ vi /path/to/jira-to-matrix/jira-to-matrix.service
# change User, WorkingDirectory, ExecStart

# Copy service definition to systemd directory
$ sudo cp /path/to/jira-to-matrix/jira-to-matrix.service /etc/systemd/system

# Enable connections to bot with Jira webhook (tcp port 4100, see your config.js)
$ sudo firewall-cmd --zone=public --add-port=4100/tcp --permanent

# Add permissions for SELinux (tcp port 4100, see your config.js)
$ sudo semanage port -a -t http_port_t -p tcp 4100

# Enable service to run at startup
$ sudo systemctl enable jira-to-matrix

# Start service
$ sudo systemctl start jira-to-matrix
```

## Описание работы

Вы можете использовать одного бота или нескольких. Если вы используете нескольких ботов - распределите комнаты между ними.
Добавьте ботов в конфигурационный файл:

```
 ...
 // Matrix params
    messenger: {
        // users with admin status
        admins: ['admin'],
        // messenger name
        name: 'matrix',
        // messenger domain
        domain: 'matrix.example.org',
        // short name, before colomn, without @
        user: 'jira_bot',
        // password
        password: 'key',
        bots: [
            {
                user: 'jira_bot2',
                password: 'key',
            },
            {
                user: 'jira_bot3',
                password: 'key',
            },
        ],
    },
```

Bots start asynchronously together, but queue processing starts after all bots start.
Time of starting depence of count room.

Logs after starting all bots:

```
well connected
2019-11-20 09:49:58.520	matrix-bots 		fluentd 		messenger-api
Matrix bot jira_bot was connected on 1 min 12 sec
2019-11-20 09:49:58.522	matrix-bots 		fluentd 		/fsm/index.js
well connected
2019-11-20 10:05:48.267	matrix-bots 		fluentd 		messenger-api
Matrix bot jira_bot_2 was connected on 17 min 2 sec
2019-11-20 10:05:48.272	matrix-bots 		fluentd 		/fsm/index.js
well connected
2019-11-20 10:11:09.108	matrix-bots 		fluentd 		messenger-api
Matrix bot jira_bot_3 was connected on 22 min 23 sec
2019-11-20 10:11:09.109	matrix-bots 		fluentd 		/fsm/index.js
All matrix bots were connected on 22 min 23 sec
2019-11-20 10:11:09.111	matrix-bots 		fluentd 		/fsm/index.js
All chat bot are connected!!!
```

После запуска на сервере бот отслеживает получаемые от Jira [вебхуки](https://developer.atlassian.com/jiradev/jira-apis/webhooks).

В случае какого-либо действия на сервере Jira, указанного в конфиге `jira.url`, будет отправлен вебхук, тело которого парсит бот и, если пользователь, который произвел действие, не в списке исключений (`usersToIgnore`), сохраняет в Redis массив доступных для пользователя действий с соответствующими данными для исполнения, полученными из тела вебхука. Если автор вебхука всё же в списке `userIgnore`, то в логе можно увидеть:

```
username: <name>, creator: <creator>, ignoreStatus: true
timestamp: <timestamp>, webhookEvent: <webhook_event>, issueName: <issue_name>, ignoreStatus: true
```

`ignoreStatus: true` зависит от:

1.  Тип хука. Обрабатываются только: issue, issuelink, project, comment. Все остальные типы буду игнорироваться.
2.  Тип задачи, настройки хранятся в REDIS (устанавливают администраторы проектов, команда !ignore).
3.  Пользователя (раздел в конфиге `usersToIgnore` и `testMode.users`). Используется для корректной работы режима разработки.

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
Started connect to chatApi
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

| Команда                                               | Описание                                                                            |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| !help                                                 | список команд с описанием                                                           |
| !comment                                              | создает комментарий в Jira issue                                                    |
| !assign <`имя пользователя`>                          | закрепит задачу за выбранным пользователем                                          |
| !move                                                 | выводит список новых возможных состояний задачи                                     |
| !move <`индекс задачи`>/<`статус задачи`>             | меняет статус задачи                                                                |
| !spec <`имя пользователя`>                            | добавляет наблюдателя над задачей                                                   |
| !prio                                                 | выводит список возможных приоритетов задачи                                         |
| !prio <`индекс приоритета`>/<`название приоритета`>   | меняет приоритет задачи                                                             |
| (admins only) !op <`имя пользователя`>                | даёт права модератора выбранному пользователю                                       |
| (admins only) !invite <`название комнаты`>            | приглашает текущего пользователя в комнату                                          |
| (admins only) !ignore [add`|`del] typeTask            | добавляет/удаляет тип задачи (task`|`error`|`bug`|`etc) для проекта текущей комнаты |
| !create <`Тип задачи`> "Название новой задачи в Jira" | создает новую задачу в Jira и добавляет ссылку на текущую задачу                    |

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

-   redis.key

```
<функция-обработчик>_<jira_body_timestamp>
```

-   redis.value

```
{
    funcName: <функция-обработчик>,
    data: <данные для обработчика>,
}
```

## Status

Успешно развернут в средней по величине компании.
