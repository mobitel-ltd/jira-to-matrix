const assert = require('assert');
const utils = require('../../src/lib/utils.js');
const { request } = require('../../src/lib/request');
const { getRequestErrorLog } = require('../../src/lib/messages');
const nock = require('nock');

describe('request testing', () => {
    const urlPath = '12345';
    const fakePath = 'error';
    const body = { result: true };

    before(() => {
        nock(utils.getRestUrl())
            .get(`/${urlPath}`)
            .reply(200, body)
            .get(`/${fakePath}`)
            .reply(400, 'Bad Request');
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect request works', async () => {
        const testUrl = utils.getRestUrl(urlPath);
        const result = await request(testUrl);

        assert.deepEqual(result, body);
    });

    it('test request with error url', async () => {
        const testUrl = utils.getRestUrl(fakePath);
        let res;
        const expected = getRequestErrorLog(testUrl, 400);

        try {
            await request(testUrl);
        } catch (err) {
            res = err;
        }
        assert.deepEqual(res, expected);
    });
});
