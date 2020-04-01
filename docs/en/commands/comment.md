## comment

`!comment <text>`

Adds a comment in the issue to Jira, then a message comes from Jira:

```
!comment 123
<bot id> commented:
<user displayname>: 123
```

In the case of an empty message body, the command will not do anything in Jira and a warning will come:

```
!comment
Add comment body
```
