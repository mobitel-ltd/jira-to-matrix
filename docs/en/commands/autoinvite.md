## autoinvite

`!autoinvite`

Add matrix-user to settings of project. This users will be added for create or edit rooms. For every project and type of task save users list.
Command can use in any projects room. Depend of project and tasks type.
This settings can use maintainers and admins projects in jira.
Examples:
Use without params !autoinvite:

If user not admin - permissions denied.

```
!autoinvite
User "jira_test" don't have admin status for this command
```

Or you will see list current settings:

```
!autoinvite
Current ignore-settings for project "INDEV":
test:
@ii_ivanov:matrix.bingo-boom.ru
@pp_petrov:matrix.bingo-boom.ru
Task:
@ss_sidorov:matrix.bingo-boom.ru
You can use comands add or del types, for example
!autoinvite add Error ii_ivanov
!autoinvite del Error ii_ivanov
```

If not settins:

```
!autoinvite
For project INDEV settings list is empty
You can use !help
```

Example use command add with params:

```
!autoinvite add Task ii_ivanov
```

Will be added to settings for task type Task user ii_ivanov, after this user will be added to all rooms whith such task type.

```
User "@ii_ivanov:matrix.bingo-boom.ru" was added for project "INDEV" for taskType "Task".
```

If such type already exist in settings:

```
Key "@ii_ivanov:matrix.bingo-boom.ru" already exist in project  "INDEV".
```

```
!autoinvite add abracadabra
```

Show tips for command:

```
Command is invalid, Use all params.
!autoinvite add | del TaskType chatUser
For example:
!autoinvite add Task ii_petrov
```

Command checked user exist in matrix:

```
!autoinvite add Task vv_putin
User "vv_putin" not in matrix
```

Example use command del with params:

```
!autoinvite del Task ii_ivanov
```

Type will be deleted from list, if exist.
If not exist:

```
This key not found in settings list for project.
```
