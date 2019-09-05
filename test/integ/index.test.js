const {WebClient} = require('@slack/web-api');
const nock = require('nock');
const supertest = require('supertest');
const faker = require('faker');
const conf = require('../../src/config');
const SlackApi = require('../../src/messengers/slack-api');
const logger = require('../../src/modules/log')('slack-api');
const FSM = require('../../src/fsm');
const app = require('../../src/jira-app');
const queueHandler = require('../../src/queue');
const utils = require('../../src/lib/utils.js');
const {cleanRedis} = require('../test-utils');
const redisUtils = require('../../src/queue/redis-data-handle.js');

const issueBody = require('../fixtures/jira-api-requests/issue-rendered.json');
const jiraCommentCreatedJSON = require('../fixtures/webhooks/comment/created.json');
const jiraIssueCreatedJSON = require('../fixtures/webhooks/issue/updated/generic.json');
const jiraProjectData = require('../fixtures/jira-api-requests/project.json');
const jiraWatchersBody = require('../fixtures/jira-api-requests/watchers.json');
const jiraRenderedIssueJSON = require('../fixtures/jira-api-requests/issue-rendered.json');
const issueLinkBody = require('../fixtures/jira-api-requests/issuelink.json');

const conversationRenameJSON = require('../fixtures/slack-requests/conversations/rename.json');
const conversationSetTopicJSON = require('../fixtures/slack-requests/conversations/setTopic.json');
const conversationMembersJSON = require('../fixtures/slack-requests/conversations/mamebers.json');
const conversationsInviteJSON = require('../fixtures/slack-requests/conversations/invite.json');
const usersConversationsJSON = require('../fixtures/slack-requests/users/conversations.json');
const postMessageJSON = require('../fixtures/slack-requests/chat/post-message.json');
const userJSON = require('../fixtures/slack-requests/user.json');
const testJSON = require('../fixtures/slack-requests/auth-test.json');
const slackConversationJSON = require('../fixtures/slack-requests/conversation.json');
const conversationPurposeJSON = require('../fixtures/slack-requests/conversations/setPurpose.json');

const chai = require('chai');
const {stub, createStubInstance} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

const request = supertest(`http://localhost:${conf.port}`);

// const messengerConfig = conf.messenger;
const messengerConfig = {
    name: 'slack',
    admins: ['test_user'],
    user: 'jirabot',
    domain: faker.internet.domainName(),
    password: faker.random.uuid(),
    eventPort: 3001,
};

const auth = {
    test: stub().resolves(testJSON.user),
};
const {channels} = usersConversationsJSON.correct;
const [expectedChannel] = channels;

const slackExpectedChannelId = faker.random.alphaNumeric(9).toUpperCase();
const slackChannels = {
    ...usersConversationsJSON.correct,
    channels: [
        ...channels,
        {
            ...expectedChannel,
            name: issueBody.key.toLowerCase(),
            id: slackExpectedChannelId,
        },
        // Add epic key of isuue_created hook to cahnnels list, it's made to handle posyEpicUpdates
        {
            ...expectedChannel,
            name: utils.getEpicKey(jiraIssueCreatedJSON).toLowerCase(),
            id: slackExpectedChannelId,
        },
    ],
};

const [linkKey] = utils.getLinkKeys(jiraIssueCreatedJSON);

const slackChannelsAfterRoomCreating = {
    ...usersConversationsJSON.correct,
    channels: [
        ...slackChannels.channels,
        {
            ...expectedChannel,
            name: jiraIssueCreatedJSON.issue.key.toLowerCase(),
            id: faker.random.alphaNumeric(9).toUpperCase(),
        },
        {
            ...expectedChannel,
            name: jiraIssueCreatedJSON.issue.fields.project.key.toLowerCase(),
            id: faker.random.alphaNumeric(9).toUpperCase(),
        },
        {
            ...expectedChannel,
            name: linkKey.toLowerCase(),
            id: faker.random.alphaNumeric(9).toUpperCase(),
        },
        {
            ...expectedChannel,
            // old issue key before moving
            name: 'rn-83',
            id: faker.random.alphaNumeric(9).toUpperCase(),
        },
    ],

};

const users = {
    // https://api.slack.com/methods/users.lookupByEmail
    lookupByEmail: stub().resolves(userJSON.correct),
    // https://api.slack.com/methods/users.conversations
    conversations:
        stub()
            .onFirstCall()
            .resolves(slackChannels)
            .onSecondCall()
            .resolves(slackChannels)
            .onThirdCall()
            .resolves(slackChannels)
            .resolves(slackChannelsAfterRoomCreating),
};
const chat = {
    // https://api.slack.com/methods/chat.postMessage
    postMessage: stub().resolves(postMessageJSON.correct),
};
const conversations = {
    // https://api.slack.com/methods/conversations.create
    create: stub().resolves(slackConversationJSON.correct),
    // https://api.slack.com/methods/conversations.invite
    invite: stub().resolves(conversationsInviteJSON.correct),
    // https://api.slack.com/methods/conversations.members
    members: stub().resolves(conversationMembersJSON.correct),
    // https://api.slack.com/methods/conversations.setTopic
    setTopic: stub().resolves(conversationSetTopicJSON),
    // https://api.slack.com/methods/conversations.rename
    rename: stub().resolves(conversationRenameJSON),
    // https://api.slack.com/methods/conversations.setPurpose
    setPurpose: stub().resolves(conversationPurposeJSON.correct),
    info: stub().resolves(expectedChannel),
};

const sdk = {...createStubInstance(WebClient), auth, conversations, users, chat};

const commandsHandler = stub().resolves();

// const methodName = conf.messenger.name === 'slack' ? 'only' : 'skip';
// describe[methodName]('Integ tests', () => {


describe('Integ tests', () => {
    const slackApi = new SlackApi({config: messengerConfig, sdk, commandsHandler, logger});

    const fsm = new FSM([slackApi], queueHandler, app, conf.port);

    beforeEach(() => {
        fsm.start();
        nock(conf.jira.url)
            .get('')
            .times(2)
            .reply(200, '<HTML>');

        nock(utils.getRestUrl())
            .get(`/issue/${linkKey}`)
            .reply(200, issueBody)
            .get(`/issue/${jiraIssueCreatedJSON.issue.key}`)
            .times(2)
            .query(utils.expandParams)
            .reply(200, jiraRenderedIssueJSON)
            .get(`/issue/${jiraIssueCreatedJSON.issue.key}`)
            .times(3)
            .reply(200, issueBody)
            .get(`/issue/${utils.getOldKey(jiraIssueCreatedJSON)}`)
            .query(utils.expandParams)
            .reply(200, jiraRenderedIssueJSON)
            .get(`/issue/${jiraIssueCreatedJSON.issue.key}/watchers`)
            .times(2)
            .reply(200, jiraWatchersBody)
            .get(`/issue/${utils.getIssueId(jiraCommentCreatedJSON)}`)
            .reply(200, issueBody)
            .get(`/issue/${utils.getEpicKey(jiraIssueCreatedJSON)}`)
            .reply(200, issueBody)
            .get(`/project/${jiraIssueCreatedJSON.issue.fields.project.key}`)
            .times(3)
            .reply(200, jiraProjectData)
            .get(`/issue/${utils.getIssueId(jiraCommentCreatedJSON)}`)
            .query(utils.expandParams)
            .reply(200, issueBody)
            .get(`/issueLink/${30137}`)
            .reply(200, issueLinkBody)
            .get(`/issueLink/${28516}`)
            .reply(200, issueLinkBody);
    });

    afterEach(async () => {
        await cleanRedis();
        nock.cleanAll();
        fsm.stop();
    });

    it('Expect all works', async () => {
        const res = await request.get('/');

        expect(slackApi.isConnected()).to.be.true;
        expect(res.status).to.be.eq(200);
        expect(res.text).to.be.eq(`Version ${process.env.npm_package_version}`);
    });

    it('Expect comment created hook to be handled', async () => {
        await request
            .post('/')
            .send(jiraCommentCreatedJSON)
            .set('Content-Type', 'application/json');

        const expectedData = {
            channel: slackExpectedChannelId,
            attachments: [{
                'text': `${utils.getHeaderText(jiraCommentCreatedJSON)}: \n${jiraCommentCreatedJSON.comment.body}`,
                'mrkdwn_in': ['text'],
            }],
        };

        expect(sdk.chat.postMessage).to.be.calledWithExactly(expectedData);
    });

    it('Expect issue_generic hook to be handled and all keys should be handled', async () => {
        await request
            .post('/')
            .send(jiraIssueCreatedJSON)
            .set('Content-Type', 'application/json');

        const expectedCreateRoomData = {
            'is_private': true,
            'name': jiraIssueCreatedJSON.issue.key.toLowerCase(),
            // 'user_ids': Array.from({length: 4}, () => userJSON.correct.user.id),
        };
        const expectedProjectRoomData = {
            'is_private': true,
            'name': jiraIssueCreatedJSON.issue.fields.project.key.toLowerCase(),
            // 'user_ids': [userJSON.correct.user.id],
        };

        const dataKeys = await redisUtils.getDataFromRedis();
        const roomKeys = await redisUtils.getRedisRooms();

        expect(sdk.conversations.create).to.be.calledWithExactly(expectedCreateRoomData);
        expect(sdk.conversations.create).to.be.calledWithExactly(expectedProjectRoomData);
        expect(dataKeys).to.be.null;
        expect(roomKeys).to.be.null;
    });
});
