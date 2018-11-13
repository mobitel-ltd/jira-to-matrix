module.exports = Object.freeze({
    port: 4100, // where to listen JIRA webhooks
    lang: 'en', // a language bot talks to users in
    jira: {
        url: 'https://jira.example.org',
        user: 'bot',
        password: 'key',
    },
    // Список допустимых действий для пользователя
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
    usersToIgnore: ['jira_test'],
    // list of users which will be avoided in inviting to room in matrix
    inviteIgnoreUsers: [],
    testMode: {
        on: true,
        users: ['ivan', 'masha'],
    },
    redis: {
        host: '127.0.0.1',
        port: 6379,
        prefix: 'jira-hooks:',
    },
    ttm_minutes: 60, // time-to-matter, how long to re-try digesting jira hooks
    matrix: {
        domain: 'matrix.example-example.org',
        user: 'bot', // short name, before colon, without @
        password: 'key',
        pollTimeout: 30000 // The number of milliseconds to wait on /sync
    },
})
