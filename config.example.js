module.exports = Object.freeze({
    port: 4100, // where to listen JIRA webhooks
    lang: 'en', // a language bot talks to users in
    jira: {
        url: 'https://jira.example.org',
        user: 'bot',
        password: 'key',
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
    },
    // useful for testing, add a test user into production config
    usersToIgnore: ['jira_test'],
    testMode: {
        on: true,
        users: ['ivan', 'masha'],
    },
    redis: {
        host: '127.0.0.1',
        port: 6379,
        prefix: 'jira-hooks:',
        ttl: 60 * 60 * 24 * 30, // seconds (30 days here)
    },
    ttm_minutes: 60, // time-to-matter, how long to re-try digesting jira hooks
    matrix: {
        domain: 'matrix.example.org',
        user: 'bot', // short name, before colon, without @
        password: 'key',
        tokenTTL: 10 * 60, // new token request interval (10 minutes here)
        syncTimeoutSec: 20, // seconds
    },
})
