# JIRA to Matrix bot

[![Build Status](https://travis-ci.org/grigori-gru/jira-to-matrix.svg?branch=master)](https://travis-ci.org/grigori-gru/jira-to-matrix)
[![codecov](https://codecov.io/gh/grigori-gru/jira-to-matrix/branch/master/graph/badge.svg)](https://codecov.io/gh/grigori-gru/jira-to-matrix)
[![dependencies Status](https://david-dm.org/grigori-gru/jira-to-matrix/status.svg)](https://david-dm.org/grigori-gru/jira-to-matrix)

A bot (web-service) which:

* listens to JIRA Webhooks and sends some stuff to Matrix;
* use command from Matrix Riot to integrate with Jira and make different actions.

## What does this Bot do?

+ Creates a room for every new issue;
+ Invites new participants to the room;
+ Posts any issue updates to the room;
+ Appropriately renames the room if the issue was moved to another project;
+ Post new links to related rooms. Notifies when a related issue's status changes;
+ Talks in English or Russian only (easily extendible, see `src/locales`).

## Requirements

- NodeJS stable
- Redis 3+
- Matrix synapse [free Matrix group chat homeserver](https://github.com/matrix-org/synapse) (in further we use `Riot` as synonym)
- Jira [development tool used by agile teams](https://www.atlassian.com/software/jira)

## Usage

### Quick start

1. [Clone](https://help.github.com/articles/cloning-a-repository/) repo.
2. Enter root directory with `package.json` and run `npm install`.
3. Create file `config.js` using [this example](https://github.com/mobitel-ltd/jira-to-matrix/blob/master/config.example.js).
4. Be sure that Redis, Jira and Matrix works correct.
5. If you want your logs to be writen in file check directory in [logs](https://github.com/mobitel-ltd/jira-to-matrix/blob/master/config.example.js#L48) exists. All logs, even webhooks bodies will be there.
6. Run `npm run start`.
7. When you see `well connected` in logs you can create some example issue in Jira. If all is OK you have to be invited in room with such name in your Matrix client!

## Work process description

After starting bot listen to all Jira [webhooks](https://developer.atlassian.com/jiradev/jira-apis/webhooks).

It means that all actions in your Jira server will be followed with webhooks. Its body we parse and save to Redis and if user is not ignored or issue is not private (it's very important for next gen Jira in cloud).

If user is ignored or issue is private we can log:
```
        username: <name>, creator: <creator>, ignoreStatus: true
        timestamp: <timestamp>, webhookEvent: <webhook_event>, issueName: <issue_name>, ignoreStatus: true
```

Redis data is handled:
1. After starting Bot Redis.
2. After saving data in Redis.
3. Every 15 min if data is still in redis and something was wrong in last attempt.

After succedded handling Redis records you can see logs with every key and result of handling:
```
Result of handling redis key <redisKey> --- <true/false>
```

If handling is succedded data will be removed, if staus is `false` it will be in Redis and next time will be handled again. It lets us to prevent some problems with connections to matrix for example.

### Matrix commands

Work with `Riot` is based on input command in room with Bot.
List of available commands:

Command | Description
---|---
!help|show all commands with description
!comment|create comment in issue
!assign <`user name or id`>|assign issue to choosen user
!move|list all available statuses of issue to move
!move <`status id`>/<`status name`>|move status of issue
!spec <`user name or id`>|add watcher to issue
!prio|list all available priorities of issue
!prio <`index of priority`>/<`index of priority`>|change priority of issue
(admins only) !op <`user name or id`>|gives admin status to user
(admins only) !invite <`room name`>/<`room id`>|invite user to room with such issue name or matrix room id

All commands are available only in rooms with Bot and that compares with Jira.
Get all commands and their rules to use in `Riot` you can get with first command - `!help`.
If you use command not correct you will get message:
```
Command <command name> not found
```

If your command is correct you will see message with info about it.

More info about all commands you can get [here](./docs/en/commands)

### Matrix client

To work with `Riot` we use [SDK Matrix](https://github.com/matrix-org/matrix-js-sdk). Starting bot connect to matrix domain from config as user like `@${config.matrix.user}:${config.matrix.domain}`. After succedded connection you will see in logs:
```
createClient OK BaseUrl: https://<domain>, userId: @<user_name>:<domain>
Started connect to chatApi
Got push rules
well connected
```

If something is wrong in connection you will get error:
```
createClient error. BaseUrl: ${baseUrl}, userId: ${userId}
```

When Bot is stopped:
```
Disconnected from Matrix
```

### Redis records structure

To be sure that no data is lost we use Redis to save parsed webhooks. Prefix in Redis which all data is saved is in config as `redis.prefix`.

Structure of records:
* redis.key
```
<function_handler>_<jira_body_timestamp>
```
* redis.value
```
{
    funcName: <function_handler>,
    data: <parsed webhook data>,
}
```

### Install Linux CentOS service with systemd

* Give ownership of directory installed jira-to-matrix to dedicated user (for security issues)
* Modify file `jira-to-matrix.service` with your configuration
* Copy file `jira-to-matrix.service` to `/etc/systemd/system/` and enable it
* Enable tcp-connection with firewalld from Jira webhook. Enable tcp listener with SELinux

```bash
# Add user jira-matrix-bot without homedirectory and deny system login
$ sudo useradd -M useradd -M jira-matrix-bot
$ sudo usermod -L jira-matrix-bot

# Change directory owner to new created user
$ sudo chown -R jira-matrix-bot: /path/to/jira-to-matrix

# Modify service config
$ vi /path/to/jira-to-matrix/jira-to-matrix.service
# change User, WorkingDirectory, ExecStart

# Copy service definition to systemd directory
$ sudo cp /path/to/jira-to-matrix/jira-to-matrix.servce /etc/systemd/system

# Enable connections to bot with Jira webhook (tcp port 4100, see your config.js)
$ sudo firewall-cmd --zone=public --add-port=4100/tcp --permanent

# Add permissions for SELinux (tcp port 4100, see your config.js)
$ sudo semanage port -a -t http_port_t -p tcp 4100

# Enable service to run at startup
$ sudo systemctl enable jira-to-matrix

# Start service
$ sudo systemctl start jira-to-matrix
```

### Additional docs

More information is [here](https://github.com/mobitel-ltd/jira-to-matrix/blob/master/docs)

## Status

~~The project is in a rough shape and under active development.~~ Fixed
It is successfully deployed in a medium-size company.

___
Developed with Node 8.1. Probably will work on any version having async/await.

[Russian README](./newReadme.md)
