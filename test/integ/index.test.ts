import * as R from 'ramda';
import { pipe, set, clone } from 'lodash/fp';
import nock from 'nock';
import * as faker from 'faker';
import { redis, REDIS_IGNORE_PREFIX } from '../../src/redis-client';
import { WebClient } from '@slack/web-api';
import supertest from 'supertest';
import { config } from '../../src/config';
import { SlackApi } from '../../src/messengers/slack-api';
import { FSM } from '../../src/fsm';
import { cleanRedis, getUserIdByDisplayName } from '../test-utils';
import { getLogger } from '../../src/modules/log';

import issueBody from '../fixtures/jira-api-requests/issue-rendered.json';
import notIgnoreCreatorIssueBody from '../fixtures/jira-api-requests/issue.json';
import jiraCommentCreatedJSON from '../fixtures/webhooks/comment/created.json';
import jiraIssueCreatedJSON from '../fixtures/webhooks/issue/updated/generic.json';
import jiraProjectData from '../fixtures/jira-api-requests/project.json';
import jiraWatchersBody from '../fixtures/jira-api-requests/watchers.json';
import jiraRenderedIssueJSON from '../fixtures/jira-api-requests/issue-rendered.json';
import issueLinkBody from '../fixtures/jira-api-requests/issuelink.json';

import conversationRenameJSON from '../fixtures/slack-requests/conversations/rename.json';
import conversationSetTopicJSON from '../fixtures/slack-requests/conversations/setTopic.json';
import conversationMembersJSON from '../fixtures/slack-requests/conversations/mamebers.json';
import conversationsInviteJSON from '../fixtures/slack-requests/conversations/invite.json';
import usersConversationsJSON from '../fixtures/slack-requests/users/conversations.json';
import postMessageJSON from '../fixtures/slack-requests/chat/post-message.json';
import userJSON from '../fixtures/slack-requests/user.json';
import testJSON from '../fixtures/slack-requests/auth-test.json';
import slackConversationJSON from '../fixtures/slack-requests/conversation.json';
import conversationPurposeJSON from '../fixtures/slack-requests/conversations/setPurpose.json';
import { taskTracker } from '../test-utils';

import * as chai from 'chai';
import { stub, createStubInstance } from 'sinon';
import sinonChai from 'sinon-chai';
import { Jira } from '../../src/task-trackers/jira';
import { getServer } from '../../src/server';
import { Config, ChatConfig } from '../../src/types';
import { slack } from '../fixtures/messenger-settings';
import { QueueHandler } from '../../src/queue';
import { Commands } from '../../src/bot/commands';
import { Actions } from '../../src/bot/actions';
import { ChatFasade } from '../../src/messengers/chat-fasade';
const { expect } = chai;
chai.use(sinonChai);

const logger = getLogger('slack-api');
const request = supertest(`http://localhost:${config.port}`);

const issueId = jiraCommentCreatedJSON.comment.self.split('/').reverse()[2];

// const messengerConfig = config.messenger;
// const messengerConfig = {
//     name: 'slack',
//     admins: ['test_user'],
//     user: 'jirabot',
//     domain: faker.internet.domainName(),
//     password: faker.random.uuid(),
//     eventPort: 3001,
// };

const auth = {
    test: stub().resolves(testJSON.user),
};
const { channels } = usersConversationsJSON.correct;
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
            name: taskTracker.selectors.getEpicKey(jiraIssueCreatedJSON)!.toLowerCase(),
            id: slackExpectedChannelId,
        },
        {
            ...expectedChannel,
            name: 'bbcom',
            id: slackExpectedChannelId,
        },
    ],
};

const [linkKey] = taskTracker.selectors.getLinkKeys(jiraIssueCreatedJSON);

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
    conversations: stub()
        .onFirstCall()
        .resolves(slackChannels)
        .onSecondCall()
        .resolves(slackChannels)
        .onThirdCall()
        .resolves(slackChannelsAfterRoomCreating)
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

const sdk = { ...createStubInstance(WebClient), auth, conversations, users, chat };

// const methodName = config.messenger.name === 'slack' ? 'only' : 'skip';
// describe[methodName]('Integ tests', () => {

const ignoreData = {
    INDEV: {
        taskType: ['Error'],
        autor: [],
    },
    BBQ: {
        taskType: ['task'],
        autor: [],
    },
};

const testUserId = faker.random.arrayElement(config.testMode.users);
const ignoredBody = pipe(clone, set('fields.creator.displayName', testUserId))(notIgnoreCreatorIssueBody) as any;

describe('Integ tests', () => {
    const slackConfig: Config = { ...config, messenger: slack, testMode: { ...config.testMode, on: true } };
    const testConfig: ChatConfig = { ...slackConfig, ...slackConfig.messenger.bots[0] };

    const commands = new Commands(slackConfig, taskTracker);
    const slackApi = new SlackApi(commands, testConfig, logger, sdk as any);
    const chatFasade = new ChatFasade([slackApi as any]);
    const actions = new Actions(slackConfig, taskTracker, chatFasade);
    const queueHandler = new QueueHandler(taskTracker, slackConfig, actions);
    slackApi.getUserIdByDisplayName = getUserIdByDisplayName;

    const fsm = new FSM([slackApi as any], getServer, taskTracker, slackConfig);

    beforeEach(async () => {
        fsm.start();

        const bodyToJSON = JSON.stringify(ignoreData);
        await redis.setAsync(REDIS_IGNORE_PREFIX, bodyToJSON);

        nock(config.taskTracker.url)
            .get('*')
            .times(2)
            .reply(200, '<HTML>');

        nock(taskTracker.getRestUrl())
            .get(`/issue/${linkKey}`)
            .reply(200, issueBody)
            .get(`/issue/${jiraIssueCreatedJSON.issue.key}`)
            .times(2)
            .query(Jira.expandParams)
            .reply(200, jiraRenderedIssueJSON)
            .get(`/issue/${jiraIssueCreatedJSON.issue.key}`)
            .times(4)
            .reply(200, issueBody)
            .get(`/issue/${taskTracker.selectors.getOldKey(jiraIssueCreatedJSON)}`)
            .query(Jira.expandParams)
            .reply(200, jiraRenderedIssueJSON)
            .get(`/issue/${jiraIssueCreatedJSON.issue.key}/watchers`)
            .times(2)
            .reply(200, jiraWatchersBody)
            .get(`/issue/${taskTracker.selectors.getIssueId(jiraCommentCreatedJSON)}`)
            .times(2)
            .reply(200, issueBody)
            .get(`/issue/${taskTracker.selectors.getEpicKey(jiraIssueCreatedJSON)}`)
            .reply(200, issueBody)
            .get(`/project/${jiraIssueCreatedJSON.issue.fields.project.key}`)
            .times(3)
            .reply(200, jiraProjectData)
            .get(`/issue/${taskTracker.selectors.getIssueId(jiraCommentCreatedJSON)}`)
            .times(2)
            .query(Jira.expandParams)
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

    // fix bug with url path
    it('Expect comment created hook to be handled', async () => {
        nock.cleanAll();
        const [endpoint, ...restBase] = config.taskTracker.url.split('/').reverse();
        const baseUrl = restBase.reverse().join('/');
        nock(baseUrl)
            .get('/' + endpoint)
            .times(2)
            .reply(200, '<HTML>');
        nock(taskTracker.getRestUrl())
            .get(`/issue/${issueId}`)
            .times(3)
            .reply(200, ignoredBody)
            .get(`/issue/${issueId}`)
            .query(Jira.expandParams)
            .reply(200, issueBody);
        await request
            .post('/')
            .send(jiraCommentCreatedJSON)
            .set('Content-Type', 'application/json');

        const expectedData = {
            channel: slackExpectedChannelId,
            attachments: [
                {
                    text: `${taskTracker.selectors.getHeaderText(jiraCommentCreatedJSON)}: \n${
                        jiraCommentCreatedJSON.comment.body
                    }`,
                    mrkdwn_in: ['text'],
                },
            ],
        };

        expect(sdk.chat.postMessage).to.be.called;
        expect(sdk.chat.postMessage).to.be.calledWithExactly(expectedData);
    });

    it.skip('Expect issue_generic hook to be handled and all keys should be handled', async () => {
        nock.cleanAll();
        nock(config.taskTracker.url)
            .get('*')
            .times(2)
            .reply(200, '<HTML>');
        nock(taskTracker.getRestUrl())
            .get(`/issue/BBCOM-1233`)
            .times(15)
            .reply(200, ignoredBody)
            .get(`/issue/BBCOM-801`)
            .times(15)
            .reply(200, ignoredBody)
            .get(`/issue/BBCOM-1233`)
            .query(Jira.expandParams)
            .times(15)
            .reply(200, issueBody)
            .get(`/issue/RN-83`)
            .query(Jira.expandParams)
            .times(15)
            .reply(200, issueBody)
            .get(`/issue/BBCOM-1233/watchers`)
            .times(15)
            .reply(200, jiraWatchersBody)
            .get(`/project/${jiraIssueCreatedJSON.issue.fields.project.key}`)
            .times(15)
            .reply(200, jiraProjectData)
            .get(`/issueLink/${30137}`)
            .reply(200, issueLinkBody)
            .get(`/issueLink/${28516}`)
            .reply(200, issueLinkBody);
        await request
            .post('/')
            .send(jiraIssueCreatedJSON)
            .set('Content-Type', 'application/json');

        const expectedCreateRoomData = {
            is_private: true,
            name: jiraIssueCreatedJSON.issue.key.toLowerCase(),
            // 'user_ids': Array.from({length: 4}, () => userJSON.correct.user.id),
        };
        // const expectedProjectRoomData = {
        //     is_private: true,
        //     name: jiraIssueCreatedJSON.issue.fields.project.key.toLowerCase(),
        //     // 'user_ids': [userJSON.correct.user.id],
        // };

        const dataKeys = await queueHandler.getDataFromRedis();
        const roomKeys = await queueHandler.getRedisRooms();

        expect(sdk.conversations.create).to.be.calledWithExactly(expectedCreateRoomData);
        expect(dataKeys).to.be.null;
        expect(roomKeys).to.be.null;
        // expect(sdk.conversations.create).to.be.calledWithExactly(expectedProjectRoomData);
    });

    it('GET /ignore return all ignore projects', async () => {
        const { body } = await request.get('/ignore').expect(200);
        expect(body).to.be.deep.eq(ignoreData);
    });

    it('POST /ignore add ignore project on key', async () => {
        const newIgnoreKey = { testProject: { taskType: ['test'], autor: ['Doncova'] } };
        await request
            .post('/ignore')
            .send(newIgnoreKey)
            .expect(200);

        const { body } = await request.get('/ignore');
        expect(body).to.be.deep.eq({ ...ignoreData, ...newIgnoreKey });
    });
    it('POST /ignore bad requests', async () => {
        const newIgnoreKey = 'bad key';
        await request
            .post('/ignore')
            .send(newIgnoreKey)
            .expect(404);

        await request
            .post('/ignore')
            .send()
            .expect(404);
    });
    it('PUT /ignore update ignore project on key', async () => {
        const newData = { taskType: ['test'], autor: ['Doncova'] };
        await request
            .put('/ignore/INDEV')
            .send(newData)
            .expect(200);

        const { body } = await request.get('/ignore');
        expect(body).to.be.deep.eq({ ...ignoreData, INDEV: newData });
    });
    it('DELETE /ignore delete ignore projects', async () => {
        await request.delete('/ignore/INDEV').expect(200);

        const { body } = await request.get('/ignore');
        expect(body).to.be.deep.eq(R.omit(['INDEV'], ignoreData));
    });
});
