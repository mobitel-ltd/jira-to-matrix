const {expect} = require('chai');
const logger = require('../../src/modules/log.js')(module);
const {auth} = require('../../src/jira/common');
const {fetchJSON} = require('../../src/utils/rest');
const nock = require('nock');

describe('fetchJSON tetsing', function() {
    this.timeout(15000);
    const options = {
        headers: {Authorization: auth()},
        timeout: 11000,
    };
    const request = {result: true};
    before(() => {
        logger.debug('auth', auth());
        nock('https://jira.test', {
            reqheaders: {
                Authorization: auth(),
            },
            })
            .get('/jira/rest/api/2/issue/12345')
            .reply(200, request)
            .get('/jira/rest/api/2/issue/123456789')
            .delay({
                body: 12000,
            })
            .reply(200, request);
        });

    it('test fetch', async () => {
        const testUrl = 'https://jira.test/jira/rest/api/2/issue/12345';

        const result = await fetchJSON(testUrl, auth());
        logger.debug('result', result);

        expect(result).to.deep.equal(request);
    });

    it('test fetch with error url', async () => {
        const testUrl = 'https://notjira.test/jira/rest/api/2/issue/12345';
        try {
            await fetchJSON(testUrl, auth());
        } catch (err) {
            const funcErr = () => {
                throw err;
            };
            expect(funcErr).to.throw(/Error in fetchJSON/);
        }
    });

    it('test fetch with timeout error, more 11 sec', async () => {
        const testUrl = 'https://notjira.test/jira/rest/api/2/issue/12345';
        try {
            await fetchJSON(testUrl, auth());
        } catch (err) {
            const funcErr = () => {
                throw err;
            };
            expect(funcErr).to.throw(/Error in fetchJSON/);
        }
    });
});
