import nock from 'nock';
import JSONbody from '../fixtures/webhooks/issue/updated/status-changed.json';
import noStatusChangedJSON from '../fixtures/webhooks/issue/updated/commented.json';
import epicIssueBody from '../fixtures/jira-api-requests/issue.json';
import { config } from '../../src/config';
import { cleanRedis, getChatClass, taskTracker } from '../test-utils';
import { translate } from '../../src/locales';
import { redis, getRedisEpicKey } from '../../src/redis-client';
import marked from 'marked';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { PostEpicUpdates } from '../../src/bot/actions/post-epic-updates';

const { expect } = chai;
chai.use(sinonChai);

describe('Post epic updates test', () => {
    let chatApi;
    let chatSingle;
    let postEpicUpdates: PostEpicUpdates;

    const someError = 'No roomId for';
    const postEpicUpdatesData = taskTracker.parser.getPostEpicUpdatesData(JSONbody);
    const issueKey = JSONbody.issue.key;
    const { summary } = JSONbody.issue.fields;

    const epicKey = taskTracker.selectors.getEpicKey(JSONbody);
    const roomId = 'roomId';

    const expectedData = [
        roomId,
        translate('newIssueInEpic'),
        marked(translate('issueAddedToEpic', { key: issueKey, summary, viewUrl: taskTracker.getViewUrl(issueKey) })),
    ];

    before(() => {
        nock(taskTracker.getRestUrl())
            .get(`/issue/${epicKey}`)
            .times(7)
            .reply(200, epicIssueBody)
            .get(url => url.indexOf('null') > 0)
            .reply(404);
    });

    beforeEach(() => {
        const chatClass = getChatClass();
        chatSingle = chatClass.chatApiSingle;
        chatApi = chatClass.chatApi;
        chatSingle.getRoomId
            .withArgs(postEpicUpdatesData.epicKey)
            .resolves(roomId)
            .withArgs(null)
            .rejects();
        postEpicUpdates = new PostEpicUpdates(config, taskTracker, chatApi);
    });

    afterEach(async () => {
        await cleanRedis();
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect postEpicUpdates throw error "No roomId for" if room is not exists', async () => {
        chatSingle.getRoomId.reset();
        chatSingle.getRoomId.rejects(someError);
        let res;
        try {
            await postEpicUpdates.run(postEpicUpdatesData);
        } catch (err) {
            res = err;
        }
        expect(res.includes(someError)).to.be.true;
    });

    it('Expect postEpicUpdates return true after running with correct data', async () => {
        const result = await postEpicUpdates.run(postEpicUpdatesData);

        expect(chatSingle.sendHtmlMessage).have.to.been.calledWithExactly(...expectedData);
        expect(result).to.be.true;
    });

    // it('Expect error with empty epicKey', async () => {
    //     const newBody = { ...postEpicUpdatesData, epicKey: null };
    //     let res;
    //     const expected = 'Error in postEpicUpdates';

    //     try {
    //         await postEpicUpdates.run({ chatApi, ...newBody, config, taskTracker });
    //     } catch (err) {
    //         res = err;
    //     }
    //     expect(res).to.include(expected);
    // });

    it('Expect not send message if epic key is in redis and status is not changed', async () => {
        const body = taskTracker.parser.getPostEpicUpdatesData(noStatusChangedJSON);
        await redis.addToList(getRedisEpicKey(epicIssueBody.id), body.data.id);

        const result = await postEpicUpdates.run(body);
        expect(chatSingle.sendHtmlMessage).not.to.be.called;
        expect(result).to.be.true;
    });
});
