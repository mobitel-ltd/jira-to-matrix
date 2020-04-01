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
