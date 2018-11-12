module.exports = Object.freeze({
    port: 4100, // where to listen JIRA webhooks
    lang: 'ru', // a language bot talks to users in
    jira: {
        url: 'https://jira.test-example.ru/jira',
        user: 'jira_test_bot',
        password: 'fakepasswprd',
    },
    features: {
        createRoom: true,
        inviteNewMembers: true,
        postComments: true,
        postIssueUpdates: true,
        epicUpdates: {
            newIssuesInEpic: 'on',
            issuesStatusChanged: 'on',
            field: 'customfield_10006',
            fieldAlias: 'Epic Link',
        },
        newLinks: true,
        postChangesToLinks: {
            on: true,
            // Not to post to closed issues (3 - id of status category "Done")
            ignoreDestStatusCat: [3],
        },
    },
    // useful for testing, add a test user into production config
    usersToIgnore: ['ivan_prod'],
    testMode: {
        on: true,
        users: ['ivan', 'jira_test'],
    },
    redis: {
        host: '127.0.0.1',
        port: 6379,
        prefix: 'test-jira-hooks:',
    },
    ttm_minutes: 60, // time-to-matter, how long to re-try digesting jira hooks
    inviteIgnoreUsers: [],
    matrix: {
        admins: ['jira_test'],
        domain: 'matrix.test-example.ru',
        user: 'jira_test_bot', // short name, before colon, without @
        password: 'fakepasswprd',
        pollTimeout: 30000,
    },
    log: {
        type: 'console',
        filePath: 'logs/service',
        fileLevel: 'silly',
        consoleLevel: 'debug',
    },
})
