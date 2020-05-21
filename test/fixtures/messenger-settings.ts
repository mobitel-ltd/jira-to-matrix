import * as faker from 'faker';
import { Config } from '../../src/types';

export const slack: Config['messenger'] = {
    name: 'slack',
    admins: ['jira_test'],
    domain: faker.internet.domainName(),
    eventPort: 3001,
    user: 'jira_test_bot',
    password: faker.random.uuid(),
    bots: [
        {
            user: 'jira_test_bot',
            password: faker.random.uuid(),
        },
    ],
};

export const matrix: Config['messenger'] = {
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
};
