# JIRA to Matrix bot  
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

### Status
~~The project is in a rough shape and under active development.~~ Fixed  
It is successfully deployed in a medium-size company.

___
Developed with Node 8.1. Probably will work on any version having async/await.
