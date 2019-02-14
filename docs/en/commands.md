# Команды в матриксе

All commands starts with `!`. For some commands you must be in admin list from config.

## invite

`!invite <room alias>`

Required to be an administrator

Invite bot in room where bot is joined.
If user enter name of Jira issue
If the user enters the name of the issue in Jira, then the command is case-insensitive, for example, in this case the result will be successful and the user will be invited:

```
!invite test-1
User <user id> invited in room <room name>
```

user will be invited `#TEST-1:matrix.yourdomain`.

When entering the exact alias of the form `#TEST-1:matrix.yourdomain` command is case sensitive.

If the room with the alias is not found, an error message will be sent with the wrong command text:

```
!invite notExistingRoom

Room "<notExistingRoom>" is not found
```

If user is not an administrator, then the message about the absence of rights will be sent:

```
User "<user id>" don't have admin status for this command
```

## op

`!op <user id(optional)>`

Required to be an administrator

Gives the user rights for actions inside the room, such as: throwing other participants out of the room, banning, deleting other people's messages, editing room parameters, etc.

In the absence of arguments, the command extends to its author:
```
!op
Bot changed the power level of @<user id>:matrix.yourdomain from Default (0) to Moderator (50).
```

If you specify the id of another user, then his status will be changed:
```
!op other_user
Bot changed the power level of @<other_user>:matrix.yourdomain from Default (0) to Moderator (50).
```

But for this it is imperative that the user was in the room, otherwise there will be an error message:

```
!op not_joined_user
User %{user} is not in current room
```

If user is not an administrator, then the message about the absence of rights will be sent:

```
User "<user id>" don't have admin status for this command
```

## prio

`!prio <number or name of the new priority(optional)>`

Increases the priority of the current task in Jira.

If there are no arguments, the command will display the available priority status.
```
!prio

List of available commands:
1) Highest
2) High
3) Medium
4) Low
5) Lowest
```

If you specify the priority number or its name, the priority will be changed with the corresponding status (the command is case-insensitive):

```
!prio 1
Now issue has the priority Highest
```

```
!prio hIGHeSt
Now issue has the priority Highest
```

If the task priority is specified incorrectly, the corresponding message will be:

```
!prio 123
New priority with name "123" is not found
```

## move

`!move <the number or name of the new issue status(optional)>`

Changes the status of the current task in Jira.

If there are no arguments, the command will display the available task statuses.
```
!move

List of available commands:
1) To Do
2) In Progress
3) Done
```

If you specify the priority number or its name, the task status will be changed with the corresponding status (the command is case-insensitive):
```
!move 1
Issue status changed by user <user id> to To Do
```
```
!move TO DO
Issue status changed by user <user id> to To Do
```

If the task priority is specified incorrectly, the corresponding message will be:

```
!move 123
New status with name "123" not found
```

## comment

`!comment <text>`

Adds a comment in the issue to Jira, then a message comes from Jira:
```
!comment 123
<bot id> добавил(а) комментарий:
<user displayname>: 123
```

In the case of an empty message body, the command will not do anything in Jira and a warning will come:
```
!comment
Add comment body
```

## spec

`!spec <part of user displayname/ user id>`

Adds an observer to the current task in Jira and invites the user to the matrix room:
```
!spec Иванов Иван

Watcher is added
```

```
!spec ia_ivanov

Watcher is added
```

If several people are found by a similar name, a list with the corresponding id will be displayed:

```
!spec Иванов
List users:
Иванов Иван Александрович ia_ivanov
Иванова Анна Михайловна am_ivanova
Иванов Петр Петрович pp_ivanov
```

If no one is found, a message will be sent:

```
!spec Иввввввванов
The watcher is not added! Check user name and try again
```


If the bot has an incorrect status in the project, the following notification will be displayed:

```
Иванов Иван Александрович ia_ivanov
Incorrect bot status in project <project name and link>, ask admin for help
```

If the bot was removed from the project participants or another problem with the lack of access to the task (including if it was deleted), the following notification will be displayed:

```
!assign Иванов Иван Александрович
Bot don\'t have permission to watch or make actions in this Jira issue
```

## assign

`!assign <часть user displayname/ user id>`

Makes the user an executor in the current task in Jira and invites the user to the matrix room:

```
!assign Иванов Иван

User "<user displayname>" assigned as issue performer
```

```
!assign ia_ivanov

User "<user displayname>" assigned as issue performer
```

If several people are found by a similar name, a list with the corresponding id will be displayed:

```
!assign Иванов
List users:
Иванов Иван Александрович ia_ivanov
Иванова Анна Михайловна am_ivanova
Иванов Петр Петрович pp_ivanov
```

If no one is found, a message will be sent:

```
!assign ИвввВВВВВВанов
The observer ИвввВВВВВВанов not added! Check your username and try again
```

If the bot has an incorrect status in the project, the following notification will be displayed:

```
Иванов Иван Александрович ia_ivanov
Incorrect bot status in project <project name and link>, ask admin for help
```

If the bot was removed from the project participants or another problem with the lack of access to the task (including if it was deleted), the following notification will be displayed:

```
!assign Иванов Иван Александрович
Bot don't have permission to watch or make actions in this Jira issue
```