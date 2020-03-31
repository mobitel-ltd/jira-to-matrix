## op

`!op <user id(optional)>`

Required to be an administrator

Gives the user rights for actions inside the room, such as: throwing other participants out of the room, banning, deleting other people's messages, editing room parameters, etc.

In the absence of arguments, the command extends to its author:

```
!op
Bot changed the power level of @<user id>:matrix.yourdomain from Default (0) to Moderator (50).
```

If you specify the id of another user, then his status will be changed:

```
!op other_user
Bot changed the power level of @<other_user>:matrix.yourdomain from Default (0) to Moderator (50).
```

But for this it is imperative that the user was in the room, otherwise there will be an error message:

```
!op not_joined_user
User %{user} is not in current room
```

If user is not an administrator, then the message about the absence of rights will be sent:

```
User "<user id>" don't have admin status for this command
```
