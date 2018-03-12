const assert = require('assert');
const logger = require('../../src/modules/log.js')(module);
const JiraClient = require('jira-connector');
const {auth} = require('../../src/jira/common');
const {fetchJSON} = require('../../src/utils/rest');
const nock = require('nock');
const fetch = require('node-fetch');

describe('fetchJSON tetsing', function() {
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

    it('test fetch', async () => {
        const testUrl = 'https://jira.bingo-boom.ru/jira/rest/api/2/issue/26171';

        const result = await fetchJSON(testUrl, auth());
        logger.debug('result', result);

        assert.deepEqual(result, {result: true});
    });

    it('test fetch with error url', async () => {
        try {
            const testUrl = 'https://notjira.bingo-boom.ru/jira/rest/api/2/issue/26171';

            const result = await fetchJSON(testUrl, auth());
        } catch (err) {
            const expected = [
                'Error in fetchJSON https://notjira.bingo-boom.ru/jira/rest/api/2/issue/26171',
                'FetchError: request to https://notjira.bingo-boom.ru/jira/rest/api/2/issue/26171 failed, reason: getaddrinfo ENOTFOUND notjira.bingo-boom.ru notjira.bingo-boom.ru:443',
            ].join('\n');

            assert.deepEqual(err, expected);
        }
    });
});
