const logger = require('../../src/modules/log')('slack-api');
const faker = require('faker');
const {WebClient} = require('@slack/client');
const EventEmitter = require('events');

const usersConversationsJSON = require('../fixtures/slack-requests/users/conversations.json');
const postMessageJSON = require('../fixtures/slack-requests/chat/post-message.json');
const userJSON = require('../fixtures/slack-requests/user.json');
const testJSON = require('../fixtures/slack-requests/auth-test.json');
const conversationJSON = require('../fixtures/slack-requests/conversation.json');
const SlackApi = require('../../src/messengers/slack-api');

const chai = require('chai');
const {stub, createStubInstance} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

const testConfig = {
    name: 'slack',
    admins: ['test_user'],
    user: 'jirabot',
    domain: faker.internet.domainName(),
    password: faker.random.uuid(),
    eventPassword: faker.internet.password(22),
    eventPort: 3000,
};

const testTopic = 'My topic';

const options = {name: 'my_room', topic: testTopic, invite: ['user@example.com', 'user@example.com']};

describe('Slack api testing', () => {
    const auth = {
        test: stub().resolves(testJSON.user),
    };
    const conversations = {
        // https://api.slack.com/methods/conversations.create
        create: stub().resolves(conversationJSON.correct),
        // https://api.slack.com/methods/conversations.setTopic
        setTopic: stub().resolves({ok: true, topic: testTopic}),
    };
    const users = {
        // https://api.slack.com/methods/users.lookupByEmail
        lookupByEmail: stub().resolves(userJSON.correct),
        // https://api.slack.com/methods/users.conversations
        conversations: stub().resolves(usersConversationsJSON.correct),
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
        .withArgs(testConfig.eventPassword)
        .returns(slackEventListener);

    const timelineHandler = stub().resolves();

    const slackApi = new SlackApi({config: testConfig, slackSdkClient, timelineHandler, eventApi, logger});
    beforeEach(async () => {
        await slackApi.connect();
    });

    afterEach(() => {
        slackApi.disconnect();
    });

    it('Expect api connect works correct', () => {
        const res = slackApi.isConnected();
        expect(res).to.be.true;
    });

    it('Expect create room run setTopic, setPurpose and create conversaton with correct data', async () => {
        await slackApi.connect();
        const roomId = await slackApi.createRoom(options);

        expect(roomId).to.be.eq(conversationJSON.correct.channel.id);
        const expectedData = {
            'token': testConfig.password,
            'is_private': true,
            'name': options.name,
            'user_ids': [userJSON.correct.user.id, userJSON.correct.user.id]};
        expect(slackSdkClient.conversations.create).to.be.calledWithExactly(expectedData);
    });

    it('Expect send message work correct', async () => {
        const text = 'message';
        const attachments = 'message';
        const channel = conversationJSON.correct.channel.id;

        await slackApi.sendHtmlMessage(channel, attachments, text);

        const expectedData = {
            token: testConfig.password,
            channel,
            text,
            attachments,
        };
        expect(slackSdkClient.chat.postMessage).to.be.calledWithExactly(expectedData);
    });

    it('Expect getRoomId returns correct id if it exists', async () => {
        const [channel] = usersConversationsJSON.correct.channels;
        const roomId = await slackApi.getRoomId(channel.name);

        expect(roomId).to.be.eq(channel.id);
    });

    it('Expect getRoomId returns undefined if id is not exists', async () => {
        const roomId = await slackApi.getRoomId(faker.name.firstName());

        expect(roomId).to.be.undefined;
    });
});
