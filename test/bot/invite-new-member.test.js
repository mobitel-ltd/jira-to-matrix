const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const JSONbody = require('../fixtures/webhooks/issue/updated/generic.json');
const watchersBody = require('../fixtures/jira-api-requests/watchers.json');
const {getInviteNewMembersData} = require('../../src/jira-hook-parser/parse-body.js');
const inviteNewMembers = require('../../src/bot/invite-new-members.js');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('inviteNewMembers test', () => {
    const expectedWatchers = watchersBody.watchers.map(({name}) => utils.getMatrixUserID(name));
    const mclient = {
        getRoomByAlias: stub(),
        invite: stub(),
    };

    const inviteNewMembersData = getInviteNewMembersData(JSONbody);

    before(() => {
        nock(utils.getRestUrl(), {
            reqheaders: {Authorization: utils.auth()},
        })
            .get(`/issue/${JSONbody.issue.key}/watchers`)
            .times(3)
            .reply(200, watchersBody);
    });

    beforeEach(() => {
        mclient.getRoomByAlias.resolves({
            getJoinedMembers: () => [{userId: '@jira_test:matrix.test-example.ru'}],
        });
    });

    afterEach(() => {
        Object.values(mclient).map(val => val.reset());
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect inviteNewMembers to be trown with no room for key', async () => {
        mclient.getRoomByAlias.resolves(null);

        let result;
        try {
            result = await inviteNewMembers({mclient, ...inviteNewMembersData});
        } catch (error) {
            result = error;
        }
        expect(result).to.include(utils.getDefaultErrorLog('inviteNewMembers'));
    });

    it('Expect inviteNewMembers work correct', async () => {
        const result = await inviteNewMembers({mclient, ...inviteNewMembersData});

        expect(result).to.deep.equal(expectedWatchers);
    });

    it('Expect inviteNewMembers to be trown if 404 in invite', async () => {
        mclient.invite.throws('Error in inviteStub!!!');
        let result;
        const expectedWatchers = [
            'Error in inviteNewMembers',
            'Error in inviteStub!!!',
        ].join('\n');

        try {
            await inviteNewMembers({mclient, ...inviteNewMembersData});
        } catch (err) {
            result = err;
        }
        expect(result).to.deep.equal(expectedWatchers);
    });
});
