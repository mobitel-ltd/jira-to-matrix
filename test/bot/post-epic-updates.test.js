const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const JSONbody = require('../fixtures/webhooks/issue/updated/status-changed.json');
const noStatusChangedJSON = require('../fixtures/webhooks/issue/updated/commented.json');
const epicIssueBody = require('../fixtures/jira-api-requests/issue.json');
const {getPostEpicUpdatesData} = require('../../src/jira-hook-parser/parse-body.js');
const {cleanRedis} = require('../test-utils');
const translate = require('../../src/locales');
const redis = require('../../src/redis-client');
const marked = require('marked');
const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
const postEpicUpdates = require('../../src/bot/post-epic-updates.js');
chai.use(sinonChai);

describe('Post epic updates test', () => {
    const someError = 'No roomId for';
    const postEpicUpdatesData = getPostEpicUpdatesData(JSONbody);
    const issueKey = JSONbody.issue.key;
    const {summary} = JSONbody.issue.fields;


    const epicKey = utils.getEpicKey(JSONbody);
    const matrixRoomId = 'roomId';

    const mclient = {
        sendHtmlMessage: stub(),
        getRoomId: stub(),
    };

    const expectedData = [
        matrixRoomId,
        translate('newIssueInEpic'),
        marked(translate('issueAddedToEpic', {key: issueKey, summary, viewUrl: utils.getViewUrl(issueKey)})),
    ];

    before(() => {
        nock(utils.getRestUrl(), {
            reqheaders: {Authorization: utils.auth()},
        })
            .get(`/issue/${epicKey}`)
            .times(7)
            .reply(200, epicIssueBody)
            .get(url => url.indexOf('null') > 0)
            .reply(404);
    });

    beforeEach(() => {
        mclient.getRoomId
            .withArgs(postEpicUpdatesData.epicKey)
            .resolves(matrixRoomId)
            .withArgs(null)
            .rejects();
    });

    afterEach(async () => {
        await cleanRedis();
        Object.values(mclient).map(val => val.resetHistory());
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect postEpicUpdates throw error "No roomId for" if room is not exists', async () => {
        mclient.getRoomId.reset();
        mclient.getRoomId.rejects(someError);
        let res;
        try {
            await postEpicUpdates({mclient, ...postEpicUpdatesData});
        } catch (err) {
            res = err;
        }
        expect(res.includes(someError)).to.be.true;
    });

    it('Expect postEpicUpdates returns true after running with correct data', async () => {
        const result = await postEpicUpdates({mclient, ...postEpicUpdatesData});

        expect(mclient.sendHtmlMessage).have.to.been.calledWithExactly(...expectedData);
        expect(result).to.be.true;
    });

    it('Expect error with empty epicKey', async () => {
        const newBody = {...postEpicUpdatesData, epicKey: null};
        let res;
        const expected = 'Error in postEpicUpdates';

        try {
            await postEpicUpdates({mclient, ...newBody});
        } catch (err) {
            res = err;
        }
        expect(res).to.include(expected);
    });

    it('Expect not send message if epic key is in redis and status is not changed', async () => {
        const body = getPostEpicUpdatesData(noStatusChangedJSON);
        await redis.saveToEpic(utils.getRedisEpicKey(epicIssueBody.id), body.data.id);

        const result = await postEpicUpdates({mclient, ...body});
        expect(mclient.sendHtmlMessage).not.to.be.called;
        expect(result).to.be.true;
    });
});
