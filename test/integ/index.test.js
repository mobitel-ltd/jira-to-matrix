const Ramda = require('ramda');
const { pipe, set, clone } = require('lodash/fp');
const { WebClient } = require('@slack/web-api');
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
const { cleanRedis } = require('../test-utils');
const redisUtils = require('../../src/queue/redis-data-handle.js');
const redis = require('../../src/redis-client');

const issueBody = require('../fixtures/jira-api-requests/issue-rendered.json');
const notIgnoreCreatorIssueBody = require('../fixtures/jira-api-requests/issue.json');
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
const { testMode } = require('../../src/config');

const chai = require('chai');
const { stub, createStubInstance } = require('sinon');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);

const request = supertest(`http://localhost:${conf.port}`);

const issueId = jiraCommentCreatedJSON.comment.self.split('/').reverse()[2];

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
            name: utils.getEpicKey(jiraIssueCreatedJSON).toLowerCase(),
            id: slackExpectedChannelId,
        },
        {
            ...expectedChannel,
            name: 'bbcom',
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
    conversations: stub()
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

const sdk = { ...createStubInstance(WebClient), auth, conversations, users, chat };

const commandsHandler = stub().resolves();

// const methodName = conf.messenger.name === 'slack' ? 'only' : 'skip';
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

const { httpStatus } = utils;

const testUserId = faker.random.arrayElement(testMode.users);
const ignoredBody = pipe(
    clone,
    set('fields.creator.key', testUserId),
    set('fields.creator.name', testUserId),
)(notIgnoreCreatorIssueBody);

describe('Integ tests', () => {
    const slackApi = new SlackApi({ config: messengerConfig, sdk, commandsHandler, logger });

    const fsm = new FSM([slackApi], queueHandler, app, conf.port);

    beforeEach(async () => {
        fsm.start();

        const bodyToJSON = JSON.stringify(ignoreData);
        await redis.setAsync(utils.REDIS_IGNORE_PREFIX, bodyToJSON);

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
            .times(4)
            .reply(200, issueBody)
            .get(`/issue/${utils.getOldKey(jiraIssueCreatedJSON)}`)
            .query(utils.expandParams)
            .reply(200, jiraRenderedIssueJSON)
            .get(`/issue/${jiraIssueCreatedJSON.issue.key}/watchers`)
            .times(2)
            .reply(200, jiraWatchersBody)
            .get(`/issue/${utils.getIssueId(jiraCommentCreatedJSON)}`)
            .times(2)
            .reply(200, issueBody)
            .get(`/issue/${utils.getEpicKey(jiraIssueCreatedJSON)}`)
            .reply(200, issueBody)
            .get(`/project/${jiraIssueCreatedJSON.issue.fields.project.key}`)
            .times(3)
            .reply(200, jiraProjectData)
            .get(`/issue/${utils.getIssueId(jiraCommentCreatedJSON)}`)
            .times(2)
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
        nock.cleanAll();
        nock(conf.jira.url)
            .get('')
            .times(2)
            .reply(200, '<HTML>');
        nock(utils.getRestUrl())
            .get(`/issue/${issueId}`)
            .times(2)
            .reply(200, ignoredBody)
            .get(`/issue/${issueId}`)
            .query(utils.expandParams)
            .reply(200, issueBody);
        await request
            .post('/')
            .send(jiraCommentCreatedJSON)
            .set('Content-Type', 'application/json');

        const expectedData = {
            channel: slackExpectedChannelId,
            attachments: [
                {
                    text: `${utils.getHeaderText(jiraCommentCreatedJSON)}: \n${jiraCommentCreatedJSON.comment.body}`,
                    mrkdwn_in: ['text'],
                },
            ],
        };

        expect(sdk.chat.postMessage).to.be.called;
        expect(sdk.chat.postMessage).to.be.calledWithExactly(expectedData);
    });

    it('Expect issue_generic hook to be handled and all keys should be handled', async () => {
        nock.cleanAll();
        nock(conf.jira.url)
            .get('')
            .times(2)
            .reply(200, '<HTML>');
        nock(utils.getRestUrl())
            .get(`/issue/BBCOM-1233`)
            .times(15)
            .reply(200, ignoredBody)
            .get(`/issue/BBCOM-801`)
            .times(15)
            .reply(200, ignoredBody)
            .get(`/issue/BBCOM-1233`)
            .query(utils.expandParams)
            .times(15)
            .reply(200, issueBody)
            .get(`/issue/RN-83`)
            .query(utils.expandParams)
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

        const dataKeys = await redisUtils.getDataFromRedis();
        const roomKeys = await redisUtils.getRedisRooms();

        expect(sdk.conversations.create).to.be.calledWithExactly(expectedCreateRoomData);
        expect(dataKeys).to.be.null;
        expect(roomKeys).to.be.null;
        // expect(sdk.conversations.create).to.be.calledWithExactly(expectedProjectRoomData);
    });

    it('GET /ignore return all ignore projects', async () => {
        const { body } = await request.get('/ignore').expect(httpStatus.OK);
        expect(body).to.be.deep.eq(ignoreData);
    });

    it('POST /ignore add ignore project on key', async () => {
        const newIgnoreKey = { testProject: { taskType: ['test'], autor: ['Doncova'] } };
        await request
            .post('/ignore')
            .send(newIgnoreKey)
            .expect(httpStatus.OK);

        const { body } = await request.get('/ignore');
        expect(body).to.be.deep.eq({ ...ignoreData, ...newIgnoreKey });
    });
    it('POST /ignore bad requests', async () => {
        const newIgnoreKey = 'bad key';
        await request
            .post('/ignore')
            .send(newIgnoreKey)
            .expect(httpStatus.BAD_REQUEST);

        await request
            .post('/ignore')
            .send()
            .expect(httpStatus.BAD_REQUEST);
    });
    it('PUT /ignore update ignore project on key', async () => {
        const newData = { taskType: ['test'], autor: ['Doncova'] };
        await request
            .put('/ignore/INDEV')
            .send(newData)
            .expect(httpStatus.OK);

        const { body } = await request.get('/ignore');
        expect(body).to.be.deep.eq({ ...ignoreData, INDEV: newData });
    });
    it('DELETE /ignore delete ignore projects', async () => {
        await request.delete('/ignore/INDEV').expect(httpStatus.OK);

        const { body } = await request.get('/ignore');
        expect(body).to.be.deep.eq(Ramda.omit(['INDEV'], ignoreData));
    });
});
