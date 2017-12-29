const assert = require('assert');
const logger = require('../../src/modules/log.js')(module);
// const JiraClient = require('jira-connector');
const {auth} = require('../../src/jira/common');
const {getRenderedValues, ref} = require('../../src/jira/issue');
const nock = require('nock');
const querystring = require('querystring');
const secondBody = require('../fixtures/comment-create-2.json');
const issueBody = require('../fixtures/response.json');

describe('Auth Jira', function() {
    this.timeout(15000);
    const options = {
        headers: {Authorization: auth()},
        timeout: 11000,
    };

    const issue = {
        id: 26313,
    };

    const params = querystring.stringify({expand: 'renderedFields'});

    before(() => {
        logger.debug('auth', auth());
        nock('https://jira.bingo-boom.ru', {
            reqheaders: {
                Authorization: auth()
            }
            })
            .get(`/jira/rest/api/2/issue/26313?expand=renderedFields`)
            .reply(200, issueBody);
    });

    it('getRenderedValues test', async () => {
        // logger.debug('fetchJSON', fetchJSON);

        const getRenderedValuesData = await getRenderedValues(issue.id, ['description']);
        assert.deepEqual(getRenderedValuesData, { description: '<p>Задача</p>' });
    });

    it('ref test', () => {
        const projectResult = ref(issue.id, 'projects');
        assert.equal(projectResult, 'https://jira.bingo-boom.ru/jira/projects/26313');

        const issueResult = ref(issue.id);
        assert.equal(issueResult, 'https://jira.bingo-boom.ru/jira/browse/26313');
    });

});
