const {expect} = require('chai');
const {auth} = require('../../src/lib/utils.js');
const {getRenderedValues, getProjectUrl} = require('../../src/lib/jira-request');
const {getRequestErrorLog} = require('../../src/lib/request');
const {BASE_URL} = require('../../src/matrix/timeline-handler/commands/helper.js');
const nock = require('nock');
const querystring = require('querystring');
const issueBody = require('../fixtures/response.json');
const {url} = require('../../src/config').jira;

describe('Issue test', () => {
    const issue = {
        id: 26313,
    };
    const fakeId = 1000;
    const params = {expand: 'renderedFields'};
    const queryParams = querystring.stringify(params);
    const fakePath = '/1000';

    before(() => {
        nock(BASE_URL, {
            reqheaders: {
                Authorization: auth(),
            },
        })
            .get(`/${issue.id}`)
            .query(params)
            .reply(200, issueBody)
            .get(fakePath)
            .query({expand: 'renderedFields'})
            .reply(404, 'Error!!!');
    });

    it('getRenderedValues test', async () => {
        const getRenderedValuesData = await getRenderedValues(issue.id, ['description']);
        expect(getRenderedValuesData).to.be.deep.equal({description: '<p>Задача</p>'});
    });

    it('getRenderedValues error test', async () => {
        const fakeUrl = `${BASE_URL}${fakePath}?${queryParams}`;
        const expectedData = [
            'getRenderedValues error',
            'getIssueFormatted Error',
            'Error in get issue',
            getRequestErrorLog(fakeUrl, 404),
        ];
        try {
            await getRenderedValues(fakeId, ['description']);
        } catch (error) {
            expect(error).to.be.deep.equal(expectedData.join('\n'));
        }
    });

    it('getProjectUrl test', () => {
        const projectResult = getProjectUrl(issue.id, 'projects');
        expect(projectResult).to.be.deep.equal(`${url}/projects/${issue.id}`);

        const issueResult = getProjectUrl(issue.id);
        expect(issueResult).to.be.deep.equal(`${url}/browse/${issue.id}`);
    });
});
