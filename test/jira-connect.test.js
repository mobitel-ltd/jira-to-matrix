const assert = require('assert');
const logger = require('debug')('test JIRA');
const JiraClient = require('jira-connector');
const {auth} = require('../src/jira/common');
const {fetchJSON} = require('../src/utils/rest');

describe('Auth Jira', function() {
    this.timeout(15000);

    it('test Jira client', async () => {
        const authForJiraClient = auth().split(' ')[1];
        const jira = new JiraClient( {
            host: 'jira.bingo-boom.ru/jira',
            basic_auth: {
                base64: authForJiraClient,
            },
        });
        logger('authForJiraClient', authForJiraClient);
        const data = await jira.issue.getIssue({issueKey: 'BBCOM-931'});
        logger('jira client', data);
        assert.ok(jira);
    });

    it('test fetch', async () => {
        // logger('fetchJSON', fetchJSON);
        const testUrl = 'https://jira.bingo-boom.ru/jira/rest/api/2/issue/26171';
        const result = await fetchJSON(
            testUrl,
            auth()
        );
        logger('result', result);

        assert.ok(result);
    });
});
