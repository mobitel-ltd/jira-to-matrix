## archive

`!archive kickall`

Archive all events to git server. 
If executed in Jira room export will be made to Jira project key else to repo named `default`.
Alias is required.
Command is available to room admin only or to assign or creator of Jira issue (if Jira room).

### Options

`--kickall`  
Kick all, delete alias after succeded archiving/

Example:
```
!archive --kickall
```

`--name  <repo name>`  
to export archive to custom repo, it option is more powerfull than Jira project for jira rooms

Example:
```
!archive --name my-own-repo
```
