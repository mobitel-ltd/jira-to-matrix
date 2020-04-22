const nock = require('nock');
const config = require('../../src/config');
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
        testUtils.getUserIdByDisplayName(issueBodyJSON.fields.reporter.displayName),
        testUtils.getUserIdByDisplayName(issueBodyJSON.fields.creator.displayName),
        testUtils.getUserIdByDisplayName(issueBodyJSON.fields.assignee.displayName),
    ].map(name => chatApi.getChatUserId(name));
    // ONLY english
    const watchers = watchersBody.watchers
        .map(({ displayName }) => displayName !== 'jira_bot' && displayName)
        .filter(Boolean)
        .map(testUtils.getUserIdByDisplayName)
        .map(chatApi.getChatUserId);
    const expectedWatchers = [...new Set([...members, ...watchers])];

    // const upperWatchersBody = {
    //     ...watchersBody,
    //     watchers: watchersBody.watchers.map(item => {
    //         if (emailAddress) {
    //             const name = utils.getNameFromMail(emailAddress);
    //             const emailAddress = `${name.toUpperCase()}@example.com`;

    //             return {...item, emailAddress};
    //     }

    //     return displayName;

    //     }

    //         ({ ...item, name: item.name.toUpperCase() })),
    // };

    const inviteNewMembersData = getInviteNewMembersData(JSONbody);
    const inviteUpperCase = {
        issue: {
            key: 'someKey',
            roomMembers: members.map(name => name.toUpperCase()),
        },
    };

    beforeEach(() => {
        nock(utils.getRestUrl())
            .get(`/issue/${JSONbody.issue.key}`)
            .times(2)
            .reply(200, issueBodyJSON)
            .get(`/issue/${JSONbody.issue.key}/watchers`)
            .reply(200, watchersBody)
            // .get(`/issue/${inviteUpperCase.issue.key}/watchers`)
            // .reply(200, upperWatchersBody)
            .get(`/issue/${inviteUpperCase.issue.key}`)
            .reply(200, issueBodyJSON);

        chatApi = testUtils.getChatApi({ alias: [inviteNewMembersData.issue.key, inviteUpperCase.issue.key] });
        chatApi.getRoomMembers.resolves([chatApi.getChatUserId('jira_test')]);
    });

    afterEach(() => {
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

    it.skip('Expect inviteNewMembers works correct if some Jira users in upperCase', async () => {
        const result = await inviteNewMembers({ chatApi, ...inviteUpperCase });
        expect(result).to.deep.equal(expectedWatchers);
    });

    it('Do not add member-bot, if room alredy have bot ', async () => {
        const botName = `${config.jira.user}_cloud`;
        const issueBodyJSONbot = pipe(clone, set('fields.creator.displayName', botName))(issueBodyJSON);
        const expectedWatcherWithoutCreator = expectedWatchers.filter(
            user => user !== testUtils.getUserIdByDisplayName(issueBodyJSON.fields.creator.displayName),
        );

        nock.cleanAll();
        nock(utils.getRestUrl())
            .get(`/issue/${JSONbody.issue.key}`)
            .times(2)
            .reply(200, issueBodyJSONbot)
            .get(`/issue/${JSONbody.issue.key}/watchers`)
            .reply(200, watchersBody);

        const result = await inviteNewMembers({ chatApi, ...inviteNewMembersData });

        expect(result.sort()).to.deep.equal(expectedWatcherWithoutCreator.sort());
    });

    it('Should return false if issue is not exists', async () => {
        nock.cleanAll();
        const result = await inviteNewMembers({ chatApi, ...inviteNewMembersData });

        expect(result).to.be.false;
    });
});
