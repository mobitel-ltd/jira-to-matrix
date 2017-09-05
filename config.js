module.exports = Object.freeze({
    port: 4100, // where to listen JIRA webhooks
    lang: 'en', // a language bot talks to users in
    jira: {
        url: 'https://jira.bingo-boom.ru/jira',
        user: 'jira_test_bot',
        password: 'DtUSN6LYRG',
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
    usersToIgnore: ['ivan'],
    testMode: {
        on: true,
        users: ['ivan', 'aa_makarov1', 'jira_test'],
    },
    redis: {
        host: '127.0.0.1',
        port: 6379,
        prefix: 'jira-hooks:',
        ttl: 60 * 60 * 24 * 30, // seconds (30 days here)
    },
    ttm_minutes: 60, // time-to-matter, how long to re-try digesting jira hooks
    matrix: {
        domain: 'matrix.bingo-boom.ru',
        user: 'jira_test_bot', // short name, before colon, without @
        password: 'DtUSN6LYRG',
        tokenTTL: 1000 * 60, // new token request interval (10 minutes here)
        syncTimeoutSec: 20, // seconds
    },
})
