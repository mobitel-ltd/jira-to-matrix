const nock = require('nock');
const {auth} = require('../../src/lib/utils.js');
const JSONbody = require('../fixtures/webhooks/issue/updated/generic.json');
const {getInviteNewMembersData} = require('../../src/jira-hook-parser/parse-body.js');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

const proxyquire = require('proxyquire');

const inviteNewMembers = proxyquire('../../src/bot/invite-new-members.js', {
});


describe('inviteNewMembers test', () => {
    const responce = {
        'self': 'https://jira.test-example.ru/jira/rest/api/2/issue/BBCOM-1233/watchers',
        'isWatching': false,
        'watchCount': 1,
        'watchers': [
            {
                'self': 'http://www.example.com/jira/rest/api/2/user?username=fred',
                'name': 'fred',
                'displayName': 'Fred F. User',
                'active': false,
            },
            {
                'self': 'http://www.example.com/jira/rest/api/2/user?username=alex',
                'name': 'alex',
                'displayName': 'Alex F. User',
                'active': false,
            },
            {
                'self': 'http://www.example.com/jira/rest/api/2/user?username=vasya',
                'name': 'vasya',
                'displayName': 'Vasya F. User',
                'active': false,
            },
        ],
    };

    const getRoomByAliasStub = stub();
    const inviteStub = stub();

    const mclient = {
        getRoomByAlias: getRoomByAliasStub,
        invite: inviteStub,
    };

    const inviteNewMembersData = getInviteNewMembersData(JSONbody);
    const expected = [
        '@fred:matrix.test-example.ru',
        '@alex:matrix.test-example.ru',
        '@vasya:matrix.test-example.ru',
    ];

    before(() => {
        nock('https://jira.test-example.ru', {
            reqheaders: {
                Authorization: auth(),
            },
        })
            .get(`/jira/rest/api/2/issue/BBCOM-1233/watchers`)
            .times(4)
            .reply(200, responce)
            .get(url => url.indexOf('null') > 0)
            .reply(404);
    });

    it('Get undefined with no room for key', async () => {
        getRoomByAliasStub.returns(null);
        let result;
        try {
            result = await inviteNewMembers({mclient, ...inviteNewMembersData});
        } catch (error) {
            expect(error).to.be.not.null;
        }

        expect(result).to.be.undefined;
    });

    it('Get true after running inviteNewMembers', async () => {
        getRoomByAliasStub.reset();
        getRoomByAliasStub.returns({
            getJoinedMembers: () => [{userId: '@jira_test:matrix.test-example.ru'}],
        });
        const result = await inviteNewMembers({mclient, ...inviteNewMembersData});

        expect(result).to.deep.equal(expected);
    });

    it('Get error after throw in invite', async () => {
        getRoomByAliasStub.returns({
            getJoinedMembers: () => [{userId: '@jira_test:matrix.test-example.ru'}],
        });
        inviteStub.throws('Error in inviteStub!!!');

        try {
            await inviteNewMembers({mclient, ...inviteNewMembersData});
        } catch (err) {
            const expected = [
                'Error in inviteNewMembers',
                'Error in inviteStub!!!',
            ].join('\n');
            expect(err).to.deep.equal(expected);
        }
    });
});
