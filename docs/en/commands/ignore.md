## ignore

`!ignore <add|del> <taskType>`

Command allows you to customize settings for processing hooks for current project. Task types are different for each project.

Command could use only admins in current project.
If user-not-admin try to use this command:

```
!ignore
User "<user-not-admin>" don't have admin status for this command
```

If params was added earlier you will see a message.Task types from this list you can use for del ignore-setting.

```
!ignore
Current ignore-settings for project "<current project for this room>":
    1) - Task
    2) - Epic
    3) - Bug

```

If params was NOT added earlier you will see a message:

```
!ignore
For project "<current project for this room>" ignore list is empty.
You can add ignore key !ignore add Error
```

### For add:

```
!ignore add Error
Key "Error" was added for project "<current project for this room>".
or
!ignore add Error
Key "Error" already exist in project "<current project for this room>".
```

If taskType not found:

```
!ignore add wrongTaskType
Such key not found in project "<current project for this room>"
You can use keys:
    1) - Story
    2) - Epic
    3) - Error
    4) - Task
    5) - test
    6) - Discussion
```

After add suchessfully hooks from Jira with this task type will be ignored.

### For delete:

```
!ignore del Error
Key "Error" was deleted for project "<current project for this room>".
or
!ignore del Error
This key not found in ignore list for project "<current project for this room>".
```

### How it works

Settings are saved in Redis by prefix `ignore:project` and saving to file such change.
