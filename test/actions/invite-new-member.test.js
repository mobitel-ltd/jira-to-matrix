const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const JSONbody = require('../fixtures/webhooks/issue/updated/generic.json');
const watchersBody = require('../fixtures/jira-api-requests/watchers.json');
const {getInviteNewMembersData} = require('../../src/jira-hook-parser/parse-body.js');
const inviteNewMembers = require('../../src/bot/actions/invite-new-members.js');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('inviteNewMembers test', () => {
    const expectedWatchers = watchersBody.watchers.map(({name}) => utils.getMatrixUserID(name));
    const chatApi = {
        getRoomByAlias: stub(),
        invite: stub(),
    };

    const inviteNewMembersData = getInviteNewMembersData(JSONbody);

    before(() => {
        nock(utils.getRestUrl())
            .get(`/issue/${JSONbody.issue.key}/watchers`)
            .times(3)
            .reply(200, watchersBody);
    });

    beforeEach(() => {
        chatApi.getRoomByAlias.resolves({
            getJoinedMembers: () => [{userId: '@jira_test:matrix.test-example.ru'}],
        });
    });

    afterEach(() => {
        Object.values(chatApi).map(val => val.reset());
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect inviteNewMembers to be trown with no room for key', async () => {
        chatApi.getRoomByAlias.resolves(null);

        let result;
        try {
            result = await inviteNewMembers({chatApi, ...inviteNewMembersData});
        } catch (error) {
            result = error;
        }
        expect(result).to.include(utils.getDefaultErrorLog('inviteNewMembers'));
    });

    it('Expect inviteNewMembers work correct', async () => {
        const result = await inviteNewMembers({chatApi, ...inviteNewMembersData});

        expect(result).to.deep.equal(expectedWatchers);
    });

    it('Expect inviteNewMembers to be trown if 404 in invite', async () => {
        chatApi.invite.throws('Error in inviteStub!!!');
        let result;
        const expectedWatchers = [
            'Error in inviteNewMembers',
            'Error in inviteStub!!!',
        ].join('\n');

        try {
            await inviteNewMembers({chatApi, ...inviteNewMembersData});
        } catch (err) {
            result = err;
        }
        expect(result).to.deep.equal(expectedWatchers);
    });

    it('Expect inviteNewMembers works correct if some members are in room already', async () => {
        const [userToadd, ...otherUsers] = expectedWatchers;
        chatApi.getRoomByAlias.resolves({
            getJoinedMembers: () => [
                {userId: '@jira_test:matrix.test-example.ru'},
                {userId: userToadd},
            ],
        });

        const result = await inviteNewMembers({chatApi, ...inviteNewMembersData});
        expect(result).to.deep.equal(otherUsers);
    });
});
