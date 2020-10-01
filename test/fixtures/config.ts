import * as faker from 'faker';
import { matrix } from './messenger-settings';
import { settings } from './settings';

export const config = {
    port: 4300,
    lang: faker.random.arrayElement(['ru', 'en']),
    taskTracker: {
        type: 'jira',
        url: 'https://jira.test-example.ru/jira',
        user: 'jira_bot',
        password: 'fakepasswprd',
    },
    features: {
        // noIssueRooms: true,
        createRoom: true,
        createProjectRoom: true,
        inviteNewMembers: true,
        postMilestoneUpdates: true,
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
        on: false,
        users: ['ivan', 'jira_test'],
    },
    redis: {
        host: '127.0.0.1',
        port: 6379,
        prefix: 'test-jira-hooks:',
    },
    messenger: matrix,
    // messenger: faker.random.arrayElement([slack, matrix]),
    log: {
        type: 'console',
        filePath: 'logs/service',
        fileLevel: 'silly',
        consoleLevel: 'debug',
    },
    ping: {
        interval: 10,
        count: 10,
    },
    colors: {
        // links: {
        //     purple: 'mxc://matrix.example/purple',
        //     green: 'mxc://matrix.example/green',
        //     yellow: 'mxc://matrix.example/yellow',
        //     'blue-gray': 'mxc://matrix.example/blue-gray',
        //     issue: 'mxc://matrix.example/blue-gray',
        // },
        projects: ['TEST'],
    },
    gitArchive: {
        user: 'git_test',
        password: 'test_passw0rd',
        repoPrefix: `localhost:${settings.gitServerPort}/test`,
        protocol: 'http',
    },
    delayInterval: 5,
};
