# archive

`!archive kickall`

Archive all events to git server. 
If executed in Jira room export will be made to Jira project key else to repo named `default`.
Alias is required.
Command is available to room admin only or to assign or creator of Jira issue (if Jira room).

## Options

### `--kickall, -k`
Kick all, delete alias after succeded archiving

Example:
```
!archive --kickall
```

### `--personal, -p`  
archive to repo which named as user id with replacing all symbols by template: `/[^a-z0-9_.-]+/g` to `__`

Example:
```
!archive --personal
```
