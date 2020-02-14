const faker = require('faker');

module.exports = {
    slack: {
        name: 'slack',
        admins: ['jira_test'],
        domain: faker.internet.domainName(),
        eventPort: 3001,
        user: 'jirabot',
        password: faker.random.uuid(),
        bots: [
            {
                user: 'jirabot',
                password: faker.random.uuid(),
            },
        ],
    },

    matrix: {
        name: 'matrix',
        admins: ['jira_test'],
        domain: 'matrix.test-example.ru',
        user: 'jira_test_bot',
        password: 'fakepasswprd',
        bots: [
            {
                user: 'jira_test_bot',
                password: 'fakepasswprd',
            },
        ],
    },
};
