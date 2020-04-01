## assign

`!assign <part user displayname/ user id>`

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
