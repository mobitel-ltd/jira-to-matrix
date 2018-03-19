module.exports = Object.freeze({
    port: 4100, // where to listen JIRA webhooks
    lang: 'ru', // a language bot talks to users in
    jira: {
        url: 'https://jira.bingo-boom.ru/jira',
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
        ttl: 60 * 60 * 24 * 30, // seconds (30 days here)
    },
    ttm_minutes: 60, // time-to-matter, how long to re-try digesting jira hooks
    matrix: {
        admins: ['jira_test'],
        domain: 'matrix.bingo-boom.ru',
        user: 'jira_test_bot', // short name, before colon, without @
        password: 'fakepasswprd',
        tokenTTL: 1, // new token request interval (10 minutes here)
        syncTimeoutSec: 20, // seconds
    },
    log: {
        type: 'console',
        filePath: 'logs/service',
        fileLevel: 'silly',
        consoleLevel: 'debug',
    },
})
