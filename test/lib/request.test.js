const assert = require('assert');
const {auth} = require('../../src/lib/utils.js');
const {request, getRequestErrorLog} = require('../../src/lib/request');
const nock = require('nock');
const {BASE_URL} = require('../../src/matrix/timeline-handler/commands/helper.js');

describe('request testing', () => {
    const urlPath = '/12345';
    const fakePath = '/error';
    before(() => {
        nock(BASE_URL, {
            reqheaders: {
                Authorization: auth(),
            },
        })
            .get(urlPath)
            .reply(200, {result: true})
            .get(fakePath)
            .reply(400, 'Bad Request');
    });

    it('test request', async () => {
        const testUrl = `${BASE_URL}${urlPath}`;

        const result = await request(testUrl);

        assert.deepEqual(result, {result: true});
    });

    it('test request with error url', async () => {
        const testUrl = `${BASE_URL}${fakePath}`;

        try {
            await request(testUrl);
        } catch (err) {
            const expected = getRequestErrorLog(testUrl, 400);

            assert.deepEqual(err, expected);
        }
    });
});
