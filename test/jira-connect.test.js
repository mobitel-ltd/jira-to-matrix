const assert = require('assert');
const logger = require('../src/modules/log.js')(module);
const JiraClient = require('jira-connector');
const {auth} = require('../src/jira/common');
const {fetchJSON} = require('../src/utils/rest');
const nock = require('nock');
const fetch = require('node-fetch');

describe('Auth Jira', function() {
    this.timeout(15000);
    const options = {
        headers: {Authorization: auth()},
        timeout: 11000,
    };

    before(() => {
        logger.debug('auth', auth());
        nock('https://jira.bingo-boom.ru', {
            reqheaders: {
                Authorization: auth()
            }
            })
            .get('/jira/rest/api/2/issue/26171')
            .reply(200, {result: true});  
    });
    // it('test Jira client', async () => {
    //     const authForJiraClient = auth().split(' ')[1];
    //     const jira = new JiraClient( {
    //         host: 'jira.bingo-boom.ru/jira',
    //         basic_auth: {
    //             base64: authForJiraClient,
    //         },
    //     });
    //     logger.debug('authForJiraClient', authForJiraClient);
    //     const data = await jira.issue.getIssue({issueKey: 'BBCOM-931'});
    //     logger.debug('jira client', data);
    //     assert.ok(jira);
    // });

    it('test fetch', async () => {
        // logger.debug('fetchJSON', fetchJSON);
        const testUrl = 'https://jira.bingo-boom.ru/jira/rest/api/2/issue/26171';
        
        const result = await fetchJSON(testUrl, auth());
        logger.debug('result', result);

        assert.deepEqual(result, {result: true});
    });

    it('test error url', async () => {
        // logger.debug('fetchJSON', fetchJSON);
        const testUrl = 'https://notjira.bingo-boom.ru/jira/rest/api/2/issue/26171';
        
        const result = await fetchJSON(testUrl, auth());
        logger.debug('result', result);

        assert.equal(result, null);
    });
});
