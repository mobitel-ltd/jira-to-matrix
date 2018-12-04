const proxyquire = require('proxyquire');
const {expect} = require('chai');
const {auth} = require('../../src/lib/utils.js');
const {getRenderedValues, getProjectUrl, getCollectParticipants} = require('../../src/lib/jira-request');
const {getRequestErrorLog} = require('../../src/lib/request');
const {BASE_URL} = require('../../src/matrix/timeline-handler/commands/helper.js');
const nock = require('nock');
const querystring = require('querystring');
const issueBody = require('../fixtures/response.json');
const {url} = require('../../src/config').jira;
const watchersJSON = require('../fixtures/watchers.json');

const watchersUsers = watchersJSON.watchers.map(({name}) => name);
describe('Issue test', () => {
    const issue = {
        id: 26313,
    };
    const fakeId = 1000;
    const params = {expand: 'renderedFields'};
    const queryParams = querystring.stringify(params);
    const fakePath = '/1000';
    const collectParticipantsBody = ['testName1', 'testName2'];

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
            .reply(404, 'Error!!!')
            .get(`/${issue.id}/watchers`)
            .times(4)
            .reply(200, watchersJSON);
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

    it('expect getCollectParticipants works correct', async () => {
        const url = [BASE_URL, issue.id, 'watchers'].join('/');
        const result = await getCollectParticipants({url, collectParticipantsBody});
        expect(result).to.be.deep.eq([...collectParticipantsBody, ...watchersUsers]);
    });

    it('expect getCollectParticipants works correct if watchersUrl exists', async () => {
        const url = [BASE_URL, issue.id, 'watchers'].join('/');
        const result = await getCollectParticipants({collectParticipantsBody, watchersUrl: url});
        expect(result).to.be.deep.eq([...collectParticipantsBody, ...watchersUsers]);
    });

    it('expect getCollectParticipants avoid users from ignore invite list', async () => {
        const {getCollectParticipants: getCollectParticipantsProxy} = proxyquire('../../src/lib/jira-request', {
            '../config': {
                inviteIgnoreUsers: collectParticipantsBody,
            },
        });
        const url = [BASE_URL, issue.id, 'watchers'].join('/');
        const result = await getCollectParticipantsProxy({url, collectParticipantsBody});
        expect(result).to.be.deep.eq(watchersUsers);
    });

    it('expect getCollectParticipants avoid users from ignore invite list2', async () => {
        const {getCollectParticipants: getCollectParticipantsProxy} = proxyquire('../../src/lib/jira-request', {
            '../config': {
                inviteIgnoreUsers: watchersUsers,
            },
        });
        const url = [BASE_URL, issue.id, 'watchers'].join('/');
        const result = await getCollectParticipantsProxy({url, collectParticipantsBody});
        expect(result).to.be.deep.eq(collectParticipantsBody);
    });

    it('Expect getCollectParticipants not fall if no url', async () => {
        const result = await getCollectParticipants({collectParticipantsBody});
        expect(result).to.be.deep.eq(collectParticipantsBody);
    });
});
