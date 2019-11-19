const nock = require('nock');
const { pipe, set, clone } = require('lodash/fp');
const utils = require('../../src/lib/utils.js');
const JSONbody = require('../fixtures/webhooks/issue/updated/generic.json');
const watchersBody = require('../fixtures/jira-api-requests/watchers.json');
const { getInviteNewMembersData } = require('../../src/jira-hook-parser/parse-body.js');
const inviteNewMembers = require('../../src/bot/actions/invite-new-members.js');
const testUtils = require('../test-utils');
const issueBodyJSON = require('../fixtures/jira-api-requests/issue.json');

const chai = require('chai');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);

describe('inviteNewMembers test', () => {
    let chatApi = testUtils.getChatApi();
    const members = [
        issueBodyJSON.fields.reporter.name,
        issueBodyJSON.fields.creator.name,
        issueBodyJSON.fields.assignee.name,
    ].map(name => chatApi.getChatUserId(name));
    const watchers = watchersBody.watchers.map(({ name }) => chatApi.getChatUserId(name));
    const expectedWatchers = [...new Set([...members, ...watchers])];

    const upperWatchersBody = {
        ...watchersBody,
        watchers: watchersBody.watchers.map(item => ({ ...item, name: item.name.toUpperCase() })),
    };

    const inviteNewMembersData = getInviteNewMembersData(JSONbody);
    const inviteUpperCase = {
        issue: {
            key: 'someKey',
            roomMembers: members.map(name => name.toUpperCase()),
        },
    };

    before(() => {
        nock(utils.getRestUrl())
            .get(`/issue/${JSONbody.issue.key}`)
            .times(4)
            .reply(200, issueBodyJSON)
            .get(`/issue/${JSONbody.issue.key}/watchers`)
            .times(4)
            .reply(200, watchersBody)
            .get(`/issue/${inviteUpperCase.issue.key}/watchers`)
            .reply(200, upperWatchersBody)
            .get(`/issue/${inviteUpperCase.issue.key}`)
            .reply(200, issueBodyJSON);
    });

    beforeEach(() => {
        chatApi = testUtils.getChatApi({ alias: [inviteNewMembersData.issue.key, inviteUpperCase.issue.key] });
        chatApi.getRoomMembers.resolves([chatApi.getChatUserId('jira_test')]);
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect inviteNewMembers to be thrown with no room for key', async () => {
        chatApi.getRoomMembers.resolves(null);

        let result;
        try {
            result = await inviteNewMembers({ chatApi, ...inviteNewMembersData });
        } catch (error) {
            result = error;
        }
        expect(result).to.include(utils.getDefaultErrorLog('inviteNewMembers'));
    });

    it('Expect inviteNewMembers work correct', async () => {
        const result = await inviteNewMembers({ chatApi, ...inviteNewMembersData });

        expect(result).to.deep.equal(expectedWatchers);
    });

    it('Expect inviteNewMembers to be trown if 404 in invite', async () => {
        chatApi.invite.throws('Error in inviteStub!!!');
        let result;
        const expected = ['Error in inviteNewMembers', 'Error in inviteStub!!!'].join('\n');

        try {
            await inviteNewMembers({ chatApi, ...inviteNewMembersData });
        } catch (err) {
            result = err;
        }
        expect(result).to.deep.equal(expected);
    });

    it('Expect inviteNewMembers works correct if some members are in room already', async () => {
        const [userToadd, ...otherUsers] = expectedWatchers;
        chatApi.getRoomMembers.resolves([chatApi.getChatUserId('jira_test'), userToadd]);

        const result = await inviteNewMembers({ chatApi, ...inviteNewMembersData });
        expect(result).to.deep.equal(otherUsers);
    });

    it('Expect inviteNewMembers works correct if some Jira users in upperCase', async () => {
        const result = await inviteNewMembers({ chatApi, ...inviteUpperCase });
        expect(result).to.deep.equal(expectedWatchers);
    });

    it('Do not add member-bot, if room alredy have bot ', async () => {
        const issueBodyJSONbot = pipe(
            clone,
            set('fields.creator.key', 'any_bot'),
            set('fields.creator.name', 'any_bot'),
        )(issueBodyJSON);

        nock.cleanAll();
        nock(utils.getRestUrl())
            .get(`/issue/${JSONbody.issue.key}`)
            .times(4)
            .reply(200, issueBodyJSONbot)
            .get(`/issue/${JSONbody.issue.key}/watchers`)
            .times(4)
            .reply(200, watchersBody);

        const [userToadd] = expectedWatchers;

        chatApi.getRoomMembers.resolves([chatApi.getChatUserId('any_bot'), userToadd]);

        const result = await inviteNewMembers({ chatApi, ...inviteNewMembersData });

        expect(result).to.deep.equal(watchers);
    });
});
