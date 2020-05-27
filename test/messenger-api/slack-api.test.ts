import * as faker from 'faker';
import { WebClient } from '@slack/web-api';
import { fromString } from 'html-to-text';
import messages from '../fixtures/events/slack/messages.json';
import conversationInfoJSON from '../fixtures/slack-requests/conversations/rename.json';
import conversationRenameJSON from '../fixtures/slack-requests/conversations/rename.json';
import conversationPurposeJSON from '../fixtures/slack-requests/conversations/setPurpose.json';
import conversationMembersJSON from '../fixtures/slack-requests/conversations/mamebers.json';
import conversationsInviteJSON from '../fixtures/slack-requests/conversations/invite.json';
import usersConversationsJSON from '../fixtures/slack-requests/users/conversations.json';
import postMessageJSON from '../fixtures/slack-requests/chat/post-message.json';
import userJSON from '../fixtures/slack-requests/user.json';
import testJSON from '../fixtures/slack-requests/auth-test.json';
import conversationJSON from '../fixtures/slack-requests/conversation.json';
import { SlackApi } from '../../src/messengers/slack-api';
import * as utils from '../../src/lib/utils';
import supertest from 'supertest';
import * as chai from 'chai';
import { stub, createStubInstance } from 'sinon';
import sinonChai from 'sinon-chai';
import { getLogger } from '../../src/modules/log';
import { slack } from '../fixtures/messenger-settings';
import { config } from '../../src/config';
import { Config, ChatConfig } from '../../src/types';
import { Commands } from '../../src/bot/commands';
import { taskTracker } from '../test-utils';

const logger = getLogger('slack-api');

const { expect } = chai;
chai.use(sinonChai);
// const testConfig = {
//     name: 'slack',
//     admins: ['test_user'],
//     user: 'jirabot',
//     domain: faker.internet.domainName(),
//     password: faker.random.uuid(),
//     eventPort: 3000,
// };

const slackConfig: Config = { ...config, messenger: slack };
const testConfig: ChatConfig = { ...slackConfig, ...slackConfig.messenger.bots[0] };

const request = supertest(`http://localhost:${testConfig.messenger.eventPort}`);

const testTopic = 'My topic';
const trueUserMail = 'user@example.com';
const correctSlackUserId = userJSON.correct.user.id;
const options = {
    name: 'MY_ROOM',
    topic: testTopic,
    invite: ['user@example.com', 'user1@example.com'],
    purpose: conversationPurposeJSON.correct.purpose,
};

describe('Slack api testing', () => {
    const auth = {
        test: stub().resolves(testJSON.user),
    };
    const conversations = {
        // https://api.slack.com/methods/conversations.create
        create: stub().resolves(conversationJSON.correct),
        // https://api.slack.com/methods/conversations.setTopic
        setTopic: stub().resolves({ ok: true, topic: testTopic }),
        // https://api.slack.com/methods/conversations.invite
        invite: stub().resolves(conversationsInviteJSON.correct),
        // https://api.slack.com/methods/conversations.members
        members: stub().resolves(conversationMembersJSON.correct),
        // https://api.slack.com/methods/conversations.setPurpose
        setPurpose: stub().resolves(conversationPurposeJSON.correct),
        // https://api.slack.com/methods/conversations.rename
        rename: stub().resolves(conversationRenameJSON.correct),
        // https://api.slack.com/methods/conversations.info
        info: stub().resolves(conversationInfoJSON.correct),
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

    const sdk = { ...createStubInstance(WebClient), auth, conversations, users, chat };

    const commands = new Commands(testConfig, taskTracker);
    const slackApi = new SlackApi(commands, testConfig, logger, sdk as any);

    beforeEach(async () => {
        await slackApi.connect();
    });

    afterEach(async () => {
        await slackApi.disconnect();
    });

    it('Expect api connect works correct', () => {
        const res = slackApi.isConnected();
        expect(res).to.be.true;
    });

    it('Expect create room run setTopic, setPurpose and create conversaton with correct data', async () => {
        const roomId = await slackApi.createRoom(options);

        expect(roomId).to.be.eq(conversationJSON.correct.channel.id);
        expect(sdk.conversations.create).to.be.calledWithExactly({
            is_private: true,
            name: options.name.toLowerCase(),
        });
        expect(sdk.conversations.invite).to.be.calledTwice;
        expect(sdk.conversations.setPurpose).to.be.calledWithExactly({
            channel: roomId,
            purpose: options.purpose,
        });
    });

    it('Expect send message work correct', async () => {
        const text = 'message';
        const attachments = 'message';
        const channel = conversationJSON.correct.channel.id;

        await slackApi.sendHtmlMessage(channel, attachments, text);

        const expectedData = {
            channel,
            attachments: [
                {
                    text,
                    mrkdwn_in: ['text'],
                },
            ],
        };
        expect(sdk.chat.postMessage).to.be.calledWithExactly(expectedData);
    });

    it('Expect getRoomId return correct id if it exists', async () => {
        const [channel] = usersConversationsJSON.correct.channels;
        const roomId = await slackApi.getRoomId(channel.name);

        expect(roomId).to.be.eq(channel.id);
    });

    it('Expect getRoomId throws error if id is not exists', async () => {
        let err;
        try {
            await slackApi.getRoomId(faker.name.firstName());
        } catch (error) {
            err = error;
        }
        expect(err).not.to.be.undefined;
    });

    it('Expect getRoomId return correct id if it exists and put to method in upperCase', async () => {
        const [channel] = usersConversationsJSON.correct.channels;
        const roomId = await slackApi.getRoomId(channel.name.toUpperCase());

        expect(roomId).to.be.eq(channel.id);
    });

    it('Expect invite room return true if user invited', async () => {
        const channel = conversationsInviteJSON.correct.channel.id;
        const res = await slackApi.invite(channel, trueUserMail);

        expect(res).to.be.true;
        const expectedData = {
            channel,
            users: correctSlackUserId,
        };
        expect(conversations.invite).to.be.calledWithExactly(expectedData);
    });

    it('Expect getJoinedMembers return array of members', async () => {
        const [channel] = usersConversationsJSON.correct.channels;
        const members = await slackApi.getRoomMembers({ name: channel.name });

        expect(members).to.be.an('array');
    });

    it('Expect setRoomName works well array of members', async () => {
        const { name } = conversationRenameJSON.correct.channel;
        const status = await slackApi.setRoomName(conversationJSON.correct.channel.id, name);

        expect(status).to.be.true;
        expect(conversations.rename).to.be.calledWithExactly({
            channel: conversationJSON.correct.channel.id,
            name,
        });
    });

    it.skip('Expect slack api handle correct and call if body is "!help"', async () => {
        await request
            .post('/commands')
            .send(messages.help)
            .set('Content-Type', 'application/x-www-form-urlencoded');

        expect(sdk.chat.postMessage).to.be.calledWithExactly({
            channel: messages.help.channel_id,
            attachments: [
                {
                    text: fromString(utils.helpPost),
                    mrkdwn_in: ['text'],
                },
            ],
        });
    });
});
