## projectarchive

`!projectarchive <project key> <option>`

Archive and kick all users from all chat room from input jira project. Last message to room is not earlier than 3 month ago. After operation alias will be removed. If alias exists and no bot is in this room it will be removed too. When some changes will happen in jira issue, new room creates, and after archiving all information will be addded to archive of this issue.

### Options

`--lastactive  <number of month ago>`  
used to change period when last message must be sent  

Example:
```
!projectarchive INDEV --lastactive 1
```

`--status  <status name>`  
used to archive only rooms where current status equals with input
it works only if status is ok and last message were sent later than input or default period  

Example:
```
!projectarchive INDEV --status Done
```

### Messages

1. `Add project name`  
No project key is passed.

2. `Incorrect data input <data>`  
When some option args is not valid.

3. `Project <projectKey> is added to archive with activity limit <months count> months and with current status <status name>`
When project is added to archive with expected status.

4. `Project <projectKey> is added to archive with activity limit <months count> months`
When project is added to archive.

5. `Task not exist in jira or permition denied`
Project is not exists or permission denied