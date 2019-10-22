const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const JSONbody = require('../fixtures/webhooks/issue/updated/status-changed.json');
const noStatusChangedJSON = require('../fixtures/webhooks/issue/updated/commented.json');
const epicIssueBody = require('../fixtures/jira-api-requests/issue.json');
const { getPostEpicUpdatesData } = require('../../src/jira-hook-parser/parse-body.js');
const { cleanRedis, getChatApi } = require('../test-utils');
const translate = require('../../src/locales');
const redis = require('../../src/redis-client');
const marked = require('marked');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const { expect } = chai;
const postEpicUpdates = require('../../src/bot/actions/post-epic-updates.js');
chai.use(sinonChai);

describe('Post epic updates test', () => {
    let chatApi;

    const someError = 'No roomId for';
    const postEpicUpdatesData = getPostEpicUpdatesData(JSONbody);
    const issueKey = JSONbody.issue.key;
    const { summary } = JSONbody.issue.fields;

    const epicKey = utils.getEpicKey(JSONbody);
    const roomId = 'roomId';

    const expectedData = [
        roomId,
        translate('newIssueInEpic'),
        marked(translate('issueAddedToEpic', { key: issueKey, summary, viewUrl: utils.getViewUrl(issueKey) })),
    ];

    before(() => {
        nock(utils.getRestUrl())
            .get(`/issue/${epicKey}`)
            .times(7)
            .reply(200, epicIssueBody)
            .get(url => url.indexOf('null') > 0)
            .reply(404);
    });

    beforeEach(() => {
        chatApi = getChatApi();
        chatApi.getRoomId
            .withArgs(postEpicUpdatesData.epicKey)
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

    it('Expect postEpicUpdates throw error "No roomId for" if room is not exists', async () => {
        chatApi.getRoomId.reset();
        chatApi.getRoomId.rejects(someError);
        let res;
        try {
            await postEpicUpdates({ chatApi, ...postEpicUpdatesData });
        } catch (err) {
            res = err;
        }
        expect(res.includes(someError)).to.be.true;
    });

    it('Expect postEpicUpdates returns true after running with correct data', async () => {
        const result = await postEpicUpdates({ chatApi, ...postEpicUpdatesData });

        expect(chatApi.sendHtmlMessage).have.to.been.calledWithExactly(...expectedData);
        expect(result).to.be.true;
    });

    it('Expect error with empty epicKey', async () => {
        const newBody = { ...postEpicUpdatesData, epicKey: null };
        let res;
        const expected = 'Error in postEpicUpdates';

        try {
            await postEpicUpdates({ chatApi, ...newBody });
        } catch (err) {
            res = err;
        }
        expect(res).to.include(expected);
    });

    it('Expect not send message if epic key is in redis and status is not changed', async () => {
        const body = getPostEpicUpdatesData(noStatusChangedJSON);
        await redis.saveToEpic(utils.getRedisEpicKey(epicIssueBody.id), body.data.id);

        const result = await postEpicUpdates({ chatApi, ...body });
        expect(chatApi.sendHtmlMessage).not.to.be.called;
        expect(result).to.be.true;
    });
});
