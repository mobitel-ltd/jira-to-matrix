const proxyquire = require('proxyquire');
const {expect} = require('chai');
const {auth} = require('../../src/lib/utils.js');
const {getRenderedValues, getProjectUrl, getRoomMembers} = require('../../src/lib/jira-request');
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
    const roomMembers = ['testName1', 'testName2'];

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

    it('expect getRoomMembers works correct', async () => {
        const url = [BASE_URL, issue.id, 'watchers'].join('/');
        const result = await getRoomMembers({url, roomMembers});
        expect(result).to.be.deep.eq([...roomMembers, ...watchersUsers]);
    });

    it('expect getRoomMembers works correct if watchersUrl exists', async () => {
        const url = [BASE_URL, issue.id, 'watchers'].join('/');
        const result = await getRoomMembers({roomMembers, watchersUrl: url});
        expect(result).to.be.deep.eq([...roomMembers, ...watchersUsers]);
    });

    it('expect getRoomMembers avoid users from ignore invite list', async () => {
        const {getRoomMembers: getCollectParticipantsProxy} = proxyquire('../../src/lib/jira-request', {
            '../config': {
                inviteIgnoreUsers: roomMembers,
            },
        });
        const url = [BASE_URL, issue.id, 'watchers'].join('/');
        const result = await getCollectParticipantsProxy({url, roomMembers});
        expect(result).to.be.deep.eq(watchersUsers);
    });

    it('expect getRoomMembers avoid users from ignore invite list2', async () => {
        const {getRoomMembers: getCollectParticipantsProxy} = proxyquire('../../src/lib/jira-request', {
            '../config': {
                inviteIgnoreUsers: watchersUsers,
            },
        });
        const url = [BASE_URL, issue.id, 'watchers'].join('/');
        const result = await getCollectParticipantsProxy({url, roomMembers});
        expect(result).to.be.deep.eq(roomMembers);
    });

    it('Expect getRoomMembers not fall if no url', async () => {
        const result = await getRoomMembers({roomMembers});
        expect(result).to.be.deep.eq(roomMembers);
    });

    it('Expect getRoomMembers works correct if roomMembers have "null"', async () => {
        const result = await getRoomMembers({roomMembers: [...roomMembers, null]});
        expect(result).to.be.deep.eq(roomMembers);
    });

    it('Expect getRoomMembers works correct if roomMembers is empty', async () => {
        const result = await getRoomMembers({roomMembers: []});
        expect(result).to.be.deep.eq([]);
    });
});
