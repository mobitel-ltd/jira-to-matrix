const nock = require('nock');
const querystring = require('querystring');
const proxyquire = require('proxyquire');

const utils = require('../../src/lib/utils.js');
const {expect} = require('chai');
const {getRenderedValues, getIssueWatchers, getUsers, checkUser} = require('../../src/lib/jira-request');
const {getRequestErrorLog} = require('../../src/lib/messages');
const {url} = require('../../src/config').jira;
const renderedIssueJSON = require('../fixtures/jira-api-requests/issue-rendered.json');
const watchersJSON = require('../fixtures/jira-api-requests/watchers.json');

const watchersUsers = watchersJSON.watchers.map(({name}) => name);
describe('Jira request test', () => {
    const users = [
        {
            displayName: 'Ivan Andreevich A',
            name: 'ia_a',
        },
        {
            displayName: 'Ivan Sergeevich B',
            name: 'is_b',
        },
        {
            displayName: 'Anton Matveevich C',
            name: 'am_c',
        },
        {
            displayName: 'Petr Andreevich D',
            name: 'pa_d',
        },
    ];

    const issue = {
        id: 26313,
        key: 'ABC',
    };
    const fakeKey = 'NANANAN';
    const roomMembers = ['testName1', 'testName2'];

    const params = {
        username: utils.COMMON_NAME,
        startAt: 0,
        maxResults: 3,
    };
    const errorParams = {...params, startAt: 5};
    const errorStatus = 400;

    before(() => {
        nock(utils.getRestUrl())
            .get(`/issue/${issue.key}`)
            .query(utils.expandParams)
            .reply(200, renderedIssueJSON)
            .get(`/issue/${issue.key}/watchers`)
            .times(5)
            .reply(200, watchersJSON)
            .get('/user/search')
            .query(errorParams)
            .reply(errorStatus, 'ERROR!!!')
            .get('/user/search')
            .query({...params, startAt: 3})
            .reply(200, users.slice(3))
            .get('/user/search')
            .query(params)
            .reply(200, users.slice(0, 3));
    });

    after(() => {
        nock.cleanAll();
    });

    it('getRenderedValues test', async () => {
        const getRenderedValuesData = await getRenderedValues(issue.key, ['description']);
        expect(getRenderedValuesData).to.be.deep.equal({description: renderedIssueJSON.renderedFields.description});
    });

    it('getRenderedValues error test', async () => {
        const fakeUrl = utils.getRestUrl('issue', fakeKey);
        const expectedData = [
            'getRenderedValues error',
            'getIssueFormatted Error',
            'Error in get issue',
            getRequestErrorLog(fakeUrl),
        ];
        try {
            await getRenderedValues(fakeKey, ['description']);
        } catch (error) {
            expect(error).to.be.deep.equal(expectedData.join('\n'));
        }
    });

    it('getViewUrl test', () => {
        const projectResult = utils.getViewUrl(issue.id, 'projects');
        expect(projectResult).to.be.deep.equal(`${url}/projects/${issue.id}`);

        const issueResult = utils.getViewUrl(issue.id);
        expect(issueResult).to.be.deep.equal(`${url}/browse/${issue.id}`);
    });

    it('expect getIssueWatchers works correct', async () => {
        const result = await getIssueWatchers({key: issue.key, roomMembers});
        expect(result).to.be.deep.eq([...roomMembers, ...watchersUsers]);
    });

    it('expect getIssueWatchers works correct with empty roomMembers', async () => {
        const result = await getIssueWatchers({key: issue.key});
        expect(result).to.be.deep.eq(watchersUsers);
    });

    it('expect getIssueWatchers avoid users from ignore invite list', async () => {
        const {getIssueWatchers: getCollectParticipantsProxy} = proxyquire('../../src/lib/jira-request', {
            '../config': {
                inviteIgnoreUsers: roomMembers,
            },
        });
        const result = await getCollectParticipantsProxy({key: issue.key, roomMembers});
        expect(result).to.be.deep.eq(watchersUsers);
    });

    it('expect getIssueWatchers avoid users from ignore invite list2', async () => {
        const {getIssueWatchers: getCollectParticipantsProxy} = proxyquire('../../src/lib/jira-request', {
            '../config': {
                inviteIgnoreUsers: watchersUsers,
            },
        });
        const result = await getCollectParticipantsProxy({key: issue.key, roomMembers});
        expect(result).to.be.deep.eq(roomMembers);
    });

    it('Expect getUsers returns correct users witn right length', async () => {
        const maxResults = 3;
        const startAt = 0;
        const allUsers = await getUsers(maxResults, startAt);

        expect(allUsers).to.be.deep.equal(users);
    });

    it('Expect getUsers test throws error if start is incorrect', async () => {
        const maxResults = 3;
        const startAt = 5;
        const fakeUrl = utils.getRestUrl('user', `search?${querystring.stringify(errorParams)}`);
        const expected = [
            utils.getDefaultErrorLog('getUsers'),
            getRequestErrorLog(fakeUrl, errorStatus),
        ].join('\n');

        let allUsers;
        let res;
        try {
            allUsers = await getUsers(maxResults, startAt);
        } catch (err) {
            res = err;
        }

        expect(allUsers).to.be.undefined;
        expect(res).to.be.deep.equal(expected);
    });

    it('checkUser test', () => {
        const user = {
            'name': 'test_name',
            'displayName': 'My Test User',
        };
        const result = [
            checkUser(user, 'My'),
            checkUser(user, 'MY TEST'),
            checkUser(user, 'test'),
            checkUser(user, '_NAMe'),
            checkUser(user, '_NMe'),
        ];
        expect(result).to.deep.equal([true, true, true, true, false]);
    });
});
