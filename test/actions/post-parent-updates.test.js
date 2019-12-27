const nock = require('nock');
const utils = require('../../src/lib/utils.js');
// const issueWithParentIssueCreatedJSON = require('../fixtures/webhooks/issue/parent/created.json');
const issueWithParentIssueUpdatedJSON = require('../fixtures/webhooks/issue/parent/updated.json');
const parentBody = require('../fixtures/jira-api-requests/issue.json');
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

    const someError = 'No roomId for';
    const postParentUpdatesData = getPostParentUpdatesData(issueWithParentIssueUpdatedJSON);
    const issueKey = issueWithParentIssueUpdatedJSON.issue.key;
    const { summary } = issueWithParentIssueUpdatedJSON.issue.fields;

    const parentKey = issueWithParentIssueUpdatedJSON.issue.fields.parent.key;
    const roomId = 'roomId';

    const expectedLinkSendData = [
        roomId,
        translate('newIssueInParent'),
        marked(translate('issueAddedToParent', { key: issueKey, summary, viewUrl: utils.getViewUrl(issueKey) })),
    ];
    const expectedNewStatusSendData = [
        roomId,
        translate('statusHasChanged', {
            key: issueKey,
            summary,
            status: issueWithParentIssueUpdatedJSON.changelog.items[0].toString,
        }),
        marked(
            translate('statusHasChangedMessage', {
                key: issueKey,
                viewUrl: utils.getViewUrl(issueKey),
                summary,
                name: issueWithParentIssueUpdatedJSON.user.displayName,
                status: issueWithParentIssueUpdatedJSON.changelog.items[0].toString,
            }),
        ),
    ];

    before(() => {
        nock(utils.getRestUrl())
            .get(`/issue/${parentKey}`)
            .times(7)
            .reply(200, parentBody)
            .get(url => url.indexOf('null') > 0)
            .reply(404);
    });

    beforeEach(() => {
        chatApi = getChatApi();
        chatApi.getRoomId
            .withArgs(parentKey)
            .resolves(roomId)
            .withArgs(null)
            .rejects();
    });

    afterEach(async () => {
        await cleanRedis();
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect postParentUpdates throw error "No roomId for" if room is not exists', async () => {
        chatApi.getRoomId.reset();
        chatApi.getRoomId.rejects(someError);
        let res;
        try {
            await postParentUpdates({ chatApi, ...postParentUpdatesData });
        } catch (err) {
            res = err;
        }
        expect(res.includes(someError)).to.be.true;
    });

    it('Expect postParentUpdates returns true after running with correct data', async () => {
        const result = await postParentUpdates({ chatApi, ...postParentUpdatesData });

        expect(chatApi.sendHtmlMessage).have.to.be.calledWithExactly(...expectedLinkSendData);
        expect(chatApi.sendHtmlMessage).have.to.be.calledWithExactly(...expectedNewStatusSendData);
        expect(result).to.be.true;
    });

    it('Expect error with empty epicKey', async () => {
        const newBody = { ...postParentUpdatesData, parentKey: null };
        let res;
        const expected = 'Error in postParentUpdates';

        try {
            await postParentUpdates({ chatApi, ...newBody });
        } catch (err) {
            res = err;
        }
        expect(res).to.include(expected);
    });

    it('Expect not send message if epic key is in redis and status is not changed', async () => {
        const redisKey = utils.getRedisParentKey(parentBody.id);
        await redis.saveToEpic(redisKey, postParentUpdatesData.childData.id);

        const result = await postParentUpdates({ chatApi, ...postParentUpdatesData });
        expect(chatApi.sendHtmlMessage).not.have.to.be.calledWithExactly(...expectedLinkSendData);
        expect(result).to.be.true;
    });
});
