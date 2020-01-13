const nock = require('nock');
const utils = require('../../src/lib/utils.js');
// const issueWithParentIssueCreatedJSON = require('../fixtures/webhooks/issue/parent/created.json');
const issueWithParentUpdatedJSON = require('../fixtures/webhooks/issue/parent/updated.json');
// in this case in hook we have no parent info!!!
const issueCreatedHook = require('../fixtures/webhooks/issue/parent/created.json');
const issueWithoutParent = require('../fixtures/jira-api-requests/issue.json');
const issueHasParent = require('../fixtures/jira-api-requests/issue-parent.json');
const projectJSON = require('../fixtures/jira-api-requests/project.json');
const { getPostParentUpdatesData } = require('../../src/jira-hook-parser/parse-body.js');
const { cleanRedis, getChatApi } = require('../test-utils');
const translate = require('../../src/locales');
const redis = require('../../src/redis-client');
const marked = require('marked');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const { expect } = chai;
const postParentUpdates = require('../../src/bot/actions/post-parent-updates');
chai.use(sinonChai);

describe('Post parent updates test', () => {
    let chatApi;

    const someError = 'No projectRoomId for';
    // const hasParentId = '1010101010';
    // const hasParentKey = 'SOMEISSUEKEy-123';
    const issueUpdatedData = getPostParentUpdatesData(issueWithParentUpdatedJSON);
    const issueCreatedData = getPostParentUpdatesData(issueCreatedHook);
    const issueKey = issueWithParentUpdatedJSON.issue.key;
    const { summary } = issueWithParentUpdatedJSON.issue.fields;

    const projectRoomId = 'projectRoomId';
    const parentIssueRoomId = 'parentIssueId';

    const expectedLinkSendDataNoParentIssue = [
        projectRoomId,
        translate('newIssueInParent'),
        marked(translate('issueAddedToParent', { key: issueKey, summary, viewUrl: utils.getViewUrl(issueKey) })),
    ];
    const expectedLinkSendDataHasParentIssue = [
        parentIssueRoomId,
        translate('newIssueInParent'),
        marked(translate('issueAddedToParent', { key: issueKey, summary, viewUrl: utils.getViewUrl(issueKey) })),
    ];
    const expectedNewStatusSendData = [
        parentIssueRoomId,
        translate('statusHasChanged', {
            key: issueKey,
            summary,
            status: issueCreatedHook.changelog.items[2].toString,
        }),
        marked(
            translate('statusHasChangedMessage', {
                key: issueKey,
                viewUrl: utils.getViewUrl(issueKey),
                summary,
                name: issueCreatedHook.user.displayName,
                status: issueCreatedHook.changelog.items[2].toString,
            }),
        ),
    ];

    beforeEach(() => {
        nock(utils.getRestUrl())
            .get(`/issue/${issueWithParentUpdatedJSON.issue.fields.parent.key}`)
            .reply(200, issueHasParent)
            .get(url => url.indexOf('null') > 0)
            .reply(404);

        chatApi = getChatApi();
        chatApi.getRoomId
            .withArgs(projectJSON.key)
            .resolves(projectRoomId)
            .withArgs(issueHasParent.key)
            .resolves(parentIssueRoomId)
            .withArgs(null)
            .rejects();
    });

    afterEach(async () => {
        await cleanRedis();
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect postParentUpdates throw error "No projectRoomId for" if room is not exists', async () => {
        chatApi.getRoomId.reset();
        chatApi.getRoomId.rejects(someError);
        let res;
        try {
            await postParentUpdates({ chatApi, ...issueUpdatedData });
        } catch (err) {
            res = err;
        }
        expect(res.includes(someError)).to.be.true;
    });

    describe('No parent issue', () => {
        beforeEach(() => {
            nock.cleanAll();
            nock(utils.getRestUrl())
                .get(`/issue/${issueCreatedHook.issue.key}`)
                .reply(200, issueWithoutParent)
                .get(`/project/${issueCreatedHook.issue.fields.project.key}`)
                .reply(200, projectJSON);
        });

        it('Expect send only new issue created message to a project room if no link in redis exists', async () => {
            const result = await postParentUpdates({ chatApi, ...issueCreatedData });

            expect(chatApi.sendHtmlMessage).have.to.be.calledWithExactly(...expectedLinkSendDataNoParentIssue);
            expect(result).to.be.true;
        });
    });

    describe('Parent issue exists', () => {
        beforeEach(() => {
            nock.cleanAll();
            nock(utils.getRestUrl())
                .get(`/issue/${issueCreatedHook.issue.key}`)
                .times(2)
                .reply(200, issueHasParent)
                .get(`/issue/${issueWithParentUpdatedJSON.issue.fields.parent.key}`)
                .reply(200, issueHasParent)
                .get(`/issue/${issueHasParent.fields.parent.key}`)
                .times(2)
                .reply(200, issueHasParent);
        });

        it('Expect send only new issue created message to an epic (parent issue) room if no link exists', async () => {
            const result = await postParentUpdates({ chatApi, ...issueCreatedData });

            expect(chatApi.sendHtmlMessage).have.to.be.calledWithExactly(...expectedLinkSendDataHasParentIssue);
            expect(result).to.be.true;
        });

        it('Expect postParentUpdates send new status created and new issue created if it was called at the second time', async () => {
            await postParentUpdates({ chatApi, ...issueCreatedData });
            const result = await postParentUpdates({ chatApi, ...issueCreatedData });

            expect(chatApi.sendHtmlMessage).have.to.be.calledWithExactly(...expectedLinkSendDataHasParentIssue);
            expect(chatApi.sendHtmlMessage).have.to.be.calledWithExactly(...expectedNewStatusSendData);
            expect(result).to.be.true;
        });

        it('Expect send only new issue created message to an epic (parent issue) room if no link exists and updated issue task run', async () => {
            const result = await postParentUpdates({ chatApi, ...issueUpdatedData });

            expect(chatApi.sendHtmlMessage).have.to.be.calledWithExactly(...expectedLinkSendDataHasParentIssue);
            expect(result).to.be.true;
        });
    });

    it('Expect not send message if epic key is in redis and status is not changed', async () => {
        const redisKey = utils.getRedisParentKey(issueWithoutParent.id);
        await redis.saveToEpic(redisKey, issueUpdatedData.childData.id);
        //   HasParent redis.saveToEpic(redisKey, issueUpdatedData.childData.id);

        // const result = await postParentUpdates({ chatApi, ...postParentUpdatesDataProjecHasParent });
        const result = await postParentUpdates({ chatApi, ...issueUpdatedData });
        expect(chatApi.sendHtmlMessage).not.have.to.be.calledWithExactly(...expectedLinkSendDataNoParentIssue);
        expect(result).to.be.true;
    });
});
