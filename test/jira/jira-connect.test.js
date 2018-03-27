const assert = require('assert');
const JiraClient = require('jira-connector');
const {auth} = require('../../src/jira/common');
const {request} = require('../../src/utils/rest');
const nock = require('nock');

describe('request tetsing', function() {
    this.timeout(15000);
    const options = {
        headers: {Authorization: auth()},
        timeout: 11000,
    };

    before(() => {
        nock('https://jira.bingo-boom.ru', {
            reqheaders: {
                Authorization: auth()
            }
            })
            .get('/jira/rest/api/2/issue/26171')
            .reply(200, {result: true})
            .get('/jira/rest/api/2/issue/error')
            .reply(400, 'Bad Request');
    });

    it('test request', async () => {
        const testUrl = 'https://jira.bingo-boom.ru/jira/rest/api/2/issue/26171';

        const result = await request(testUrl, auth());

        assert.deepEqual(result, {result: true});
    });

    it('test request with error url', async () => {
        try {
            const testUrl = 'https://jira.bingo-boom.ru/jira/rest/api/2/issue/error';

            const result = await request(testUrl, auth());
        } catch (err) {
            const expected = [
                'Error in request https://jira.bingo-boom.ru/jira/rest/api/2/issue/error, status is 400',
                'Bad Request',
            ].join('\n');

            assert.deepEqual(err, expected);
        }
    });

    it('test request with correst url second time (should be error)', async () => {
        try {
            const testUrl = 'https://notjira.bingo-boom.ru/jira/rest/api/2/issue/26171';

            const result = await request(testUrl, auth());
        } catch (err) {
            const expected = [
                'Error in request https://notjira.bingo-boom.ru/jira/rest/api/2/issue/26171, status is undefined',
                'Error: getaddrinfo ENOTFOUND notjira.bingo-boom.ru notjira.bingo-boom.ru:443',
            ].join('\n');

            assert.deepEqual(err, expected);
        }
    });
});
