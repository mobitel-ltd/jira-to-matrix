# Configure Jira to work with the bot

In Jira, you need to create a user with administrator rights. Its `id` must match the` id` of the matrix. In addition, you need to configure the post [webhooks](https://developer.atlassian.com/server/jira/platform/webhooks/) to the address where your bot will be deployed with a port from [config](../../config.example.js). The list of hooks processed by the bot is located [here](./webhooks-info.md).

## Cloud Jira

There are 2 types of projects in cloud Jira - [next-gen](https://confluence.atlassian.com/jirasoftwarecloud/get-started-with-next-gen-projects-945104903.html) и [classic](https://confluence.atlassian.com/jirasoftwarecloud/create-a-project-in-your-new-jira-experience-937886053.html?_ga=2.195359916.1498656668.1545639220-550282915.1540463548). For the bot to work correctly, you must add to the project participants and:
- for `next-gen` projects add a bot to the administrators of the current project
- for `classic` projects, DO NOT add to admins

If your privacy is configured, the bot will process only those hooks that are related to tasks from public projects and those private projects where it is a participant.

## Local Jira

For the bot to work, just add it to the Jira admins.
