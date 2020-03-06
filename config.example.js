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
    messenger: {
        // users with admin status
        admins: ['admin'],
        // messenger name
        name: 'matrix',
        // messenger domain
        domain: 'matrix.example.org',
        // short name, before colomn, without @
        user: 'bot',
        // password
        password: 'key',
        bots: [
            {
                user: 'bot2',
                password: 'key',
            },
            {
                user: 'bot3',
                password: 'key',
            },
        ],
        // info room
        // optional
        infoRoom: {
            // users that will be in info room
            // if no field, admins will be added
            users: ['tt_test1', 'tt_test2'],
            // room alias in chat
            name: 'INFO',
        },
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
    },
    // Optional reconnect data
    ping: {
        // interval reconnect by default 500
        interval: 10,
        // how many times tring reconnect by default 10
        count: 10,
    },
    // colors links to update according to every color in jira
    // you must upload it before and get links to set them here
    // Optionally
    colors: {
        //
        links: {
            // This link used when you create room
            issue: 'mxc://matrix.example/purple',
            // colors, at least green, yellow, blue-gray must be
            green: 'mxc://matrix.example/green',
            yellow: 'mxc://matrix.example/yellow',
            'blue-gray': 'mxc://matrix.example/blue-gray',
            // additional is possible according to your custom jira color
            purple: 'mxc://matrix.example/purple',
        },
        // Projects to use
        // You can use this action for some projects only
        // if you want to set all - projects: 'all'
        // if you want to SKIP for all - just don't use this field or skip colors
        projects: ['TEST'],
    },
    gitArchive: {
        user: 'string',
        password: 'string',
        repoPrefix: 'string',
    },
});
