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
!prio Highest
Now issue has the priority Highest
```

If the task priority is specified incorrectly, the corresponding message will be:

```
!prio 123
New priority with name "123" is not found
```
