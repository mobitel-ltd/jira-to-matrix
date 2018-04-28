const assert = require('assert');
const JiraClient = require('jira-connector');
const {auth} = require('../../src/jira/common');
const {request, getRequestErrorLog} = require('../../src/utils/rest');
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
        const testUrl = 'https://jira.bingo-boom.ru/jira/rest/api/2/issue/error';
        try {

            const result = await request(testUrl, auth());
        } catch (err) {
            const expected = getRequestErrorLog(testUrl, 400);

            assert.deepEqual(err, expected);
        }
    });
});
