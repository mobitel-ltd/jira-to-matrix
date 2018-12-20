const proxyquire = require('proxyquire');
const {expect} = require('chai');
const {auth, getViewUrl, getRestUrl, expandParams} = require('../../src/lib/utils.js');
const {getRenderedValues, getRoomMembers} = require('../../src/lib/jira-request');
const {getRequestErrorLog} = require('../../src/lib/messages');
const nock = require('nock');
const issueBody = require('../fixtures/jira-api-requests/issue-renderfields.json');
const {url} = require('../../src/config').jira;
const watchersJSON = require('../fixtures/jira-api-requests/watchers.json');

const watchersUsers = watchersJSON.watchers.map(({name}) => name);
describe('Issue test', () => {
    const issue = {
        id: 26313,
    };
    const fakeId = 1000;
    const fakeEndPoint = '1000';
    const roomMembers = ['testName1', 'testName2'];

    before(() => {
        nock(getRestUrl('issue'), {
            reqheaders: {
                Authorization: auth(),
            },
        })
            .get(`/${issue.id}`)
            .query(expandParams)
            .reply(200, issueBody)
            .get(`/${fakeEndPoint}`)
            .query(expandParams)
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
        const fakeUrl = getRestUrl('issue', fakeEndPoint);
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

    it('getViewUrl test', () => {
        const projectResult = getViewUrl(issue.id, 'projects');
        expect(projectResult).to.be.deep.equal(`${url}/projects/${issue.id}`);

        const issueResult = getViewUrl(issue.id);
        expect(issueResult).to.be.deep.equal(`${url}/browse/${issue.id}`);
    });

    it('expect getRoomMembers works correct', async () => {
        const url = getRestUrl('issue', issue.id, 'watchers');
        const result = await getRoomMembers({url, roomMembers});
        expect(result).to.be.deep.eq([...roomMembers, ...watchersUsers]);
    });

    it('expect getRoomMembers works correct if watchersUrl exists', async () => {
        const url = getRestUrl('issue', issue.id, 'watchers');
        const result = await getRoomMembers({roomMembers, watchersUrl: url});
        expect(result).to.be.deep.eq([...roomMembers, ...watchersUsers]);
    });

    it('expect getRoomMembers avoid users from ignore invite list', async () => {
        const {getRoomMembers: getCollectParticipantsProxy} = proxyquire('../../src/lib/jira-request', {
            '../config': {
                inviteIgnoreUsers: roomMembers,
            },
        });
        const url = getRestUrl('issue', issue.id, 'watchers');
        const result = await getCollectParticipantsProxy({url, roomMembers});
        expect(result).to.be.deep.eq(watchersUsers);
    });

    it('expect getRoomMembers avoid users from ignore invite list2', async () => {
        const {getRoomMembers: getCollectParticipantsProxy} = proxyquire('../../src/lib/jira-request', {
            '../config': {
                inviteIgnoreUsers: watchersUsers,
            },
        });
        const url = getRestUrl('issue', issue.id, 'watchers');
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
