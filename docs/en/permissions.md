# Доступ бота к хукам

## Требование к задачам

У задачи не изменяется дата начала и окончания.

### [New-gen проекты](https://confluence.atlassian.com/jirasoftwarecloud/creating-editing-and-deleting-independent-projects-942834583.html?_ga=2.195359916.1498656668.1545639220-550282915.1540463548)

1. Проект публичный.
2. Если проект приватный, то бот должен быть участником проекта.
- Бот как админ в Jira имеет доступ к информации по проекту, но задачи для него будут закрыты.

### [Classic проекты](https://confluence.atlassian.com/jirasoftwarecloud/create-a-project-in-your-new-jira-experience-937886053.html?_ga=2.195359916.1498656668.1545639220-550282915.1540463548)

1. Проект публичный.

## Требование к пользователям

Автор задачи или действия не находится в списке `usersToIgnore` в [конфиге](../../config.example.js).
