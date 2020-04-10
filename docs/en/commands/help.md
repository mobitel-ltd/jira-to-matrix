# Commands in Matrix

All commands starts with `!` For some commands you must be in admin list from config.

## invite

`!invite <room alias>`

Required to be an administrator, invite user to room with such issue name or matrix room id.
[more info](./invite.md)

## op

`!op <user id(optional)>`

Required to be an administrator

Gives the user rights for actions inside the room, such as: throwing other participants out of the room, banning, deleting other people's messages, editing room parameters, etc.
[more info](./op.md)

## prio

`!prio <number or name of the new priority(optional)>`

Increases the priority of the current task in Jira.
[more info](./prio.md)

## move

`!move <the number or name of the new issue status(optional)>`

Changes the status of the current task in Jira.
[more info](./move.md)

## comment

`!comment <text>`

Adds a comment in the issue to Jira, then a message comes from Jira:
[more info](./comment.md)

## spec

`!spec <part of user displayname/ user id>`

Adds an observer to the current task in Jira and invites the user to the matrix room:
[more info](./spec.md)

## assign

`!assign <часть user displayname/ user id>`

Makes the user an executor in the current task in Jira and invites the user to the matrix room.
[more info](./assign.md)

## ignore

`!ignore <add|del> <taskType>`

Command allows you to customize settings for processing hooks for current project. Task types are different for each project.
Command could use only admins in current project.
[more info](./ignore.md)

## create

`!create <type task> name for new issue`

Create new issue in Jira and add link to current issue
[more info](./create.md)

## alive

`!alive`

**Only command room action**

Check bot connection.
[more info](./alive.md)

## getInfo

`!getInfo <project name>`

**Only command room action**

The command will display information about all rooms where bot is joined.
[more info](./getinfo.md)

## autoinvite

`!autoinvite`

Add matrix-user to settings of project. This users will be added for create or edit rooms. For every project and type of task save users list.
Command can use in any projects room. Depend of project and tasks type.
This settings can use maintainers and admins projects in jira.
[more info](./autoinvite.md)

## archive

`!archive`

Arhive this room to git-server.

### options


-k, --kickall *Kick all room members after archiving*   
-p, --personal *Archive to user repo by his userId*

[more info](./archive.md)
