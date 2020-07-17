import { pipe, set, clone } from 'lodash/fp';
import nock from 'nock';
import * as utils from '../../src/lib/utils';
import JSONbody from '../fixtures/webhooks/issue/updated/generic.json';
import watchersBody from '../fixtures/jira-api-requests/watchers.json';
import issueBodyJSON from '../fixtures/jira-api-requests/issue.json';
import { InviteNewMembers } from '../../src/bot/actions/invite-new-members';
import { getChatClass, taskTracker, getUserIdByDisplayName } from '../test-utils';
import { config } from '../../src/config';

import * as chai from 'chai';
import sinonChai from 'sinon-chai';
const { expect } = chai;
chai.use(sinonChai);

describe('inviteNewMembers test', () => {
    let chatSingle;
    let inviteNewMembers: InviteNewMembers;

    const members = [
        getUserIdByDisplayName(issueBodyJSON.fields.reporter.displayName),
        getUserIdByDisplayName(issueBodyJSON.fields.creator.displayName),
        getUserIdByDisplayName(issueBodyJSON.fields.assignee.displayName),
    ].map(name => getChatClass().chatApiSingle.getChatUserId(name));
    // ONLY english
    const watchers = watchersBody.watchers
        .map(({ displayName }) => displayName !== 'jira_bot' && displayName)
        .filter(Boolean)
        .map(getUserIdByDisplayName)
        .map(getChatClass().chatApiSingle.getChatUserId);
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

    const inviteNewMembersData = taskTracker.parser.getInviteNewMembersData(JSONbody);
    const inviteUpperCase = {
        issue: {
            key: 'someKey',
            roomMembers: members.map(name => name.toUpperCase()),
        },
    };

    beforeEach(() => {
        nock(taskTracker.getRestUrl())
            .get(`/issue/${JSONbody.issue.key}`)
            .times(2)
            .reply(200, issueBodyJSON)
            .get(`/issue/${JSONbody.issue.key}/watchers`)
            .reply(200, watchersBody)
            // .get(`/issue/${inviteUpperCase.issue.key}/watchers`)
            // .reply(200, upperWatchersBody)
            .get(`/issue/${inviteUpperCase.issue.key}`)
            .reply(200, issueBodyJSON);

        const chatClass = getChatClass({
            alias: [inviteNewMembersData.key, inviteUpperCase.issue.key],
        });
        chatSingle = chatClass.chatApiSingle;
        chatSingle.getRoomMembers.resolves([chatSingle.getChatUserId('jira_test')]);

        const chatApi = chatClass.chatApi;
        inviteNewMembers = new InviteNewMembers(config, taskTracker, chatApi);
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it('Expect inviteNewMembers to be thrown with no room for key', async () => {
        chatSingle.getRoomMembers.resolves(null);

        let result;
        try {
            result = await inviteNewMembers.run(inviteNewMembersData);
        } catch (error) {
            result = error;
        }
        expect(result).to.include(utils.getDefaultErrorLog('inviteNewMembers'));
    });

    it('Expect inviteNewMembers work correct', async () => {
        const result = await inviteNewMembers.run(inviteNewMembersData);

        expect(result).to.deep.equal(expectedWatchers);
    });

    it('Expect inviteNewMembers to be trown if 404 in invite', async () => {
        chatSingle.invite.throws('Error in inviteStub!!!');
        let result;
        const expected = ['Error in inviteNewMembers', 'Error in inviteStub!!!'].join('\n');

        try {
            await inviteNewMembers.run(inviteNewMembersData);
        } catch (err) {
            result = err;
        }
        expect(result).to.deep.equal(expected);
    });

    it('Expect inviteNewMembers works correct if some members are in room already', async () => {
        const [userToadd, ...otherUsers] = expectedWatchers;

        chatSingle.getRoomMembers.resolves([chatSingle.getChatUserId('jira_test'), userToadd]);

        const result = await inviteNewMembers.run(inviteNewMembersData);
        expect(result).to.deep.equal(otherUsers);
    });

    it.skip('Expect inviteNewMembers works correct if some Jira users in upperCase', async () => {
        const result = await inviteNewMembers.run(inviteUpperCase as any);
        expect(result).to.deep.equal(expectedWatchers);
    });

    it('Do not add member-bot, if room alredy have bot ', async () => {
        const botName = `${config.taskTracker.user}_cloud`;
        const issueBodyJSONbot = pipe(clone, set('fields.creator.displayName', botName))(issueBodyJSON);
        const expectedWatcherWithoutCreator = expectedWatchers.filter(
            user => user !== getUserIdByDisplayName(issueBodyJSON.fields.creator.displayName),
        );

        nock.cleanAll();
        nock(taskTracker.getRestUrl())
            .get(`/issue/${JSONbody.issue.key}`)
            .times(2)
            .reply(200, issueBodyJSONbot as any)
            .get(`/issue/${JSONbody.issue.key}/watchers`)
            .reply(200, watchersBody);

        const result = await inviteNewMembers.run(inviteNewMembersData);

        expect(result && result.sort()).to.deep.equal(expectedWatcherWithoutCreator.sort());
    });

    it('Should return false if issue is not exists', async () => {
        nock.cleanAll();
        const result = await inviteNewMembers.run(inviteNewMembersData);

        expect(result).to.be.false;
    });
});
