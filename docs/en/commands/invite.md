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
