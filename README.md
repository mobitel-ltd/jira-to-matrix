# JIRA to Matrix bot

[![Build Status](https://travis-ci.org/grigori-gru/jira-to-matrix.svg?branch=master)](https://travis-ci.org/grigori-gru/jira-to-matrix)
[![codecov](https://codecov.io/gh/grigori-gru/jira-to-matrix/branch/master/graph/badge.svg)](https://codecov.io/gh/grigori-gru/jira-to-matrix)
[![dependencies Status](https://david-dm.org/grigori-gru/jira-to-matrix/status.svg)](https://david-dm.org/grigori-gru/jira-to-matrix)

A bot (web-service) which:

* listens to JIRA Webhooks and sends some stuff to Matrix;
* use command from Matrix Riot to integrate with Jira and make different actions.

### Features
+ Creates a room for every new issue;
+ Invites new participants to the room;
+ Posts any issue updates to the room;
+ Appropriately renames the room if the issue was moved to another project;
+ Post new links to related rooms. Notifies when a related issue's status changes;
+ Talks in English or Russian only (easily extendible, see `src/locales`).
### How to use
Make some config copying _config.example.js_. Run
`$ node . -c "path_to_config"`
It will say if something is wrong.

### Install Linux CentOS service with systemd 
* Give ownership of directory installed jira-to-matrix to dedicated user (for security issues)
* Modify file `jira-to-matrix.service` with your configuration
* Copy file `jira-to-matrix.service` to `/etc/systemd/system/` and enable it

```bash
# Add user jira-matrix-bot without homedirectory and deny system login
$ useradd -M useradd -M jira-matrix-bot
$ usermod -L jira-matrix-bot
    
# Change directory owner to new created user
$ chown -R jira-matrix-bot: /path/to/jira-to-matrix

# Modify service config
$ vi /path/to/jira-to-matrix/jira-to-matrix.service
# change User, WorkingDirectory, ExecStart

# Copy service definition to systemd directory
$ sudo cp /path/to/jira-to-matrix/jira-to-matrix.servce /etc/systemd/system

# Enable service to run at startup
$ systemctl enable jira-to-matrix

# Start service
$ systemctl start jira-to-matrix
```

### Status
~~The project is in a rough shape and under active development.~~ Fixed
It is successfully deployed in a medium-size company.

___
Developed with Node 8.1. Probably will work on any version having async/await.

[Russian README](https://github.com/grigori-gru/jira-to-matrix/blob/master/newReadme.md)
