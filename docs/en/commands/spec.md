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
