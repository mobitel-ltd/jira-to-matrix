# kick

`!kick`

Kick all room members exept admin and action bot.   
Required 
* power level 100 (room admin)
* issue creator (for Jira rooms)

## Options

### `--all, -a`  
If option `--all` is used, all room members, except admins and bot will be kicked.

Example:
```
!kick --all
```

### `--user, -u [userId]`  
If option `--user` is used, room member with such id will be kicked.

Example:
```
!kick --user ii_ivanov
```

