const {WebClient} = require('@slack/client');
const nock = require('nock');
const supertest = require('supertest');
const faker = require('faker');
const EventEmitter = require('events');
const conf = require('../../src/config');
const SlackApi = require('../../src/messengers/slack-api');
const logger = require('../../src/modules/log')('slack-api');
const FSM = require('../../src/fsm');
const app = require('../../src/jira-app');
const queueHandler = require('../../src/queue');
const utils = require('../../src/lib/utils.js');
const {cleanRedis} = require('../test-utils');
// const translate = require('../../src/locales');

const issueBody = require('../fixtures/jira-api-requests/issue-rendered.json');
const jiraCommentCreatedJSON = require('../fixtures/webhooks/comment/created.json');
const conversationsInviteJSON = require('../fixtures/slack-requests/conversations/invite.json');
const usersConversationsJSON = require('../fixtures/slack-requests/users/conversations.json');
const postMessageJSON = require('../fixtures/slack-requests/chat/post-message.json');
const userJSON = require('../fixtures/slack-requests/user.json');
const testJSON = require('../fixtures/slack-requests/auth-test.json');
const slackConversationJSON = require('../fixtures/slack-requests/conversation.json');

const chai = require('chai');
const {stub, createStubInstance} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

const request = supertest(`http://localhost:${conf.port}`);

const messengerConfig = conf.messenger;
const testTopic = 'My topic';

const auth = {
    test: stub().resolves(testJSON.user),
};
const conversations = {
    // https://api.slack.com/methods/conversations.create
    create: stub().resolves(slackConversationJSON.correct),
    // https://api.slack.com/methods/conversations.setTopic
    setTopic: stub().resolves({ok: true, topic: testTopic}),
    // https://api.slack.com/methods/conversations.invite
    invite: stub().resolves(conversationsInviteJSON.correct),
};

const {channels} = usersConversationsJSON.correct;
const [expectedChannel] = channels;
const slackExpectedChannelId = faker.random.alphaNumeric(9).toUpperCase();
const slackChannels = {
    ...usersConversationsJSON.correct,
    channels: [...channels, {...expectedChannel, name: issueBody.key.toLowerCase(), id: slackExpectedChannelId}],
};
const users = {
    // https://api.slack.com/methods/users.lookupByEmail
    lookupByEmail: stub().resolves(userJSON.correct),
    // https://api.slack.com/methods/users.conversations
    conversations: stub().resolves(slackChannels),
};
const chat = {
    // https://api.slack.com/methods/chat.postMessage
    postMessage: stub().resolves(postMessageJSON.correct),
};

const slackSdkClient = {...createStubInstance(WebClient), auth, conversations, users, chat};

const slackEventListener = {
    ...createStubInstance(EventEmitter),
    start: stub().resolves(),
    stop: stub(),
};

const eventApi = stub()
    .withArgs(messengerConfig.eventPassword)
    .returns(slackEventListener);

const timelineHandler = stub().resolves();


describe.skip('Integ tests', () => {
    const slackApi = new SlackApi({config: messengerConfig, slackSdkClient, timelineHandler, eventApi, logger});

    const fsm = new FSM(slackApi, queueHandler, app, conf.port);

    before(() => {
        fsm.start();
    });

    beforeEach(() => {
        nock(conf.jira.url)
            .get('')
            .times(2)
            .reply(200, '<HTML>');

        nock(utils.getRestUrl())
            .get(`/issue/${utils.getIssueId(jiraCommentCreatedJSON)}`)
            .reply(200, issueBody)
            .get(`/issue/${utils.getIssueId(jiraCommentCreatedJSON)}`)
            .query(utils.expandParams)
            .reply(200, issueBody);
    });

    after(async () => {
        fsm.stop();
        nock.cleanAll();
        await cleanRedis();
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
            token: conf.messenger.password,
            channel: slackExpectedChannelId,
            text: `${utils.getHeaderText(jiraCommentCreatedJSON)}: \n${jiraCommentCreatedJSON.comment.body}`,
        };

        expect(slackSdkClient.chat.postMessage).to.be.calledWithExactly(expectedData);
    });

    // it('Expect create room to be handled', async () => {
    //     await request
    //         .post('/')
    //         .send(jiraCommentCreatedJSON)
    //         .set('Content-Type', 'application/json');

    //     const expectedData = {
    //         token: conf.messenger.password,
    //         channel: slackExpectedChannelId,
    //         text: `${utils.getHeaderText(jiraCommentCreatedJSON)}: \n${jiraCommentCreatedJSON.comment.body}`,
    //     };

    //     expect(slackSdkClient.chat.postMessage).to.be.calledWithExactly(expectedData);
    // });
});
