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
Текущие настройки автоприглашений для проекта "INDEV":
test:
@ii_ivanov:matrix.bingo-boom.ru
@pp_petrov:matrix.bingo-boom.ru
Task:
@ss_sidorov:matrix.bingo-boom.ru
Вы можете использовать команды добавления или удаления типов, например
!autoinvite add Error ii_ivanov
!autoinvite del Error ii_ivanov
```

If not settins:

```
!autoinvite
Для проекта INDEV настройки пока не сделаны.
Вы можете воспользоваться командой !help
```

Порядок вызова команды добавления (add) с параметрами:

```
!autoinvite add Task ii_ivanov
```

Добавит в настройки для типа задачи Task пользователя ii_ivanov, после этого пользователь будет добавляться во все комнаты с таким типом задачи:

```
Пользователь "@ii_ivanov:matrix.bingo-boom.ru" был добавлен для проекта "INDEV" для типов задач "Task".
```

Если такой тип уже был ранее добавлен в проект:

```
Ключ "@ii_ivanov:matrix.bingo-boom.ru" уже добавлен добавлен для проекта "INDEV".
```

```
!autoinvite add abracadabra
```

Выведет подсказку по команде:

```
Команда введена неверно, укажите все необходимые параметры.
!autoinvite add | del TaskType chatUser
Например:
!autoinvite add Task ii_petrov
```

Команда проверяет есть ли такой пользователь в матриксе

```
!autoinvite add Task vv_putin
Пользователя "vv_putin" нет в Matrix
```

Порядок вызова команды удаления (del) с параметрами:

```
!autoinvite del Task ii_ivanov
```

Тип будет удален из списка, если он там был
Если такого типа в списке не было:

```
Ключ не найден в настройках проекта "INDEV".
```
