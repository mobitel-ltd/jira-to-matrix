## create

`!create <type task> name for new issue`

Create new issue in Jira and add link to current issue:

```
!create Task My new task

New link, this task relates to "New-Jira-key" "My new task"
```

variables:

```
!create
Types of task for project "TCP":
1) - Task
2) - Epic
3) - Bug
```

```
!create Task
Issue name exist.
Use !create typeTask name task for jira
```

The algorithm for creating a connection between a new task and the current one:

1. If the current task is an epic, a child task is created for the current epic.
2. If the task being created is a subtask, then a child task is created for the current task.
3. In the epic, you cannot create subtasks.
4. If the task being created is not a subtask and the current task is not epic, a connection `relates to` is created between the tasks
