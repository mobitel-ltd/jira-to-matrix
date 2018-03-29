const {expect} = require('chai');
const {auth} = require('../../src/jira/common');
const {getRenderedValues, getProjectUrl} = require('../../src/jira').issue;
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
    const fakeId = 1000;

    const params = querystring.stringify({expand: 'renderedFields'});

    before(() => {
        nock('https://jira.bingo-boom.ru', {
            reqheaders: {
                Authorization: auth()
            }
            })
            .get(`/jira/rest/api/2/issue/26313?expand=renderedFields`)
            .reply(200, issueBody)
            .get('/jira/rest/api/2/issue/1000?expand=renderedFields')
            .reply(403, 'Error!!!')
    });

    it('getRenderedValues test', async () => {
        const getRenderedValuesData = await getRenderedValues(issue.id, ['description']);
        expect(getRenderedValuesData).to.be.deep.equal({ description: '<p>Задача</p>' });
    });

    it('getRenderedValues error test', async () => {
        const expectedData = [
            'getRenderedValues error',
            'getIssueFormatted Error',
            'Error in get issue',
            'Error in request https://jira.bingo-boom.ru/jira/rest/api/2/issue/1000?expand=renderedFields, status is 403\nError!!!'
        ];
        try {
            const getRenderedValuesData = await getRenderedValues(fakeId, ['description']);
        } catch (error) {
            console.log(error);
            expect(error).to.be.deep.equal(expectedData.join('\n'));
        }
    });

    it('getProjectUrl test', () => {
        const projectResult = getProjectUrl(issue.id, 'projects');
        expect(projectResult).to.be.deep.equal('https://jira.bingo-boom.ru/jira/projects/26313');

        const issueResult = getProjectUrl(issue.id);
        expect(issueResult).to.be.deep.equal('https://jira.bingo-boom.ru/jira/browse/26313');
    });

});
