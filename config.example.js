module.exports = Object.freeze({
  // where to listen JIRA webhooks
  port: 4100,
   // a language bot talks to users in
  lang: 'en',
  // jira params
  jira: {
      // url of your jira
      url: 'https://jira.example.org',
      // jira user name
      user: 'bot',
      // user password
      password: 'key',
  },
  // list of available actions for current user
  features: {
      // create room
      createRoom: true,
      // invite new member in room
      inviteNewMembers: true,
      // post comment in Riot
      postComments: true,
      // create/update issue in jira and associated room in Riot
      postIssueUpdates: true,
      // create/update epic in jira and associated room in Riot
      epicUpdates: {
          newIssuesInEpic: 'on',
          issuesStatusChanged: 'on',
          field: 'customfield_10006',
          fieldAlias: 'Epic Link',
      },
      // create new associated in Riot with other rooms (issue in Jira)
      newLinks: true,
      // update links in Riot with other rooms (issue in Jira)
      postChangesToLinks: {
          on: true,
          // Not to post to closed issues (3 - id of status category "Done")
          ignoreDestStatusCat: [3],
      },
  },
  // useful for testing, add a test user into production config
  usersToIgnore: ['jira_test'],
  // list of users which will be avoided in inviting to room in matrix
  inviteIgnoreUsers: [],
  testMode: {
      on: true,
      users: ['ivan', 'masha'],
  },
  // redis params
  redis: {
      host: '127.0.0.1',
      port: 6379,
      prefix: 'jira-hooks:',
  },
  // Matrix params
  matrix: {
      // domain name of your Matrix server
      domain: 'matrix.example.org',
      // short name, before colomn, without @
      user: 'bot',
      password: 'key',
      pollTimeout: 30000 // The number of milliseconds to wait on /sync
  },
  // log params based on winston https://github.com/winstonjs/winston
  log: {
      // type of log output
      type: 'both',
      // path to log file
      filePath: 'logs/service',
      // log level saved in file
      fileLevel: 'silly',
      // log level in console
      consoleLevel: 'debug',
  }
});
