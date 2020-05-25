import nock from 'nock';
import * as utils from '../../src/lib/utils';
import JSONbody from '../fixtures/webhooks/issue/updated/status-changed.json';
import noStatusChangedJSON from '../fixtures/webhooks/issue/updated/commented.json';
import epicIssueBody from '../fixtures/jira-api-requests/issue.json';
import { getPostEpicUpdatesData } from '../../src/jira-hook-parser/parsers/jira/parse-body';
import { config } from '../../src/config';
import { cleanRedis, getChatClass, taskTracker } from '../test-utils';
import { translate } from '../../src/locales';
import { redis } from '../../src/redis-client';
import marked from 'marked';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { postEpicUpdates } from '../../src/bot/actions/post-epic-updates';

const { expect } = chai;
chai.use(sinonChai);

describe('Post epic updates test', () => {
    let chatApi;
    let chatSingle;

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
        const chatClass = getChatClass();
        chatSingle = chatClass.chatApiSingle;
        chatApi = chatClass.chatApi;
        chatSingle.getRoomId
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
        chatSingle.getRoomId.reset();
        chatSingle.getRoomId.rejects(someError);
        let res;
        try {
            await postEpicUpdates({ chatApi, ...postEpicUpdatesData, taskTracker, config });
        } catch (err) {
            res = err;
        }
        expect(res.includes(someError)).to.be.true;
    });

    it('Expect postEpicUpdates return true after running with correct data', async () => {
        const result = await postEpicUpdates({ chatApi, ...postEpicUpdatesData, config, taskTracker });

        expect(chatSingle.sendHtmlMessage).have.to.been.calledWithExactly(...expectedData);
        expect(result).to.be.true;
    });

    // it('Expect error with empty epicKey', async () => {
    //     const newBody = { ...postEpicUpdatesData, epicKey: null };
    //     let res;
    //     const expected = 'Error in postEpicUpdates';

    //     try {
    //         await postEpicUpdates({ chatApi, ...newBody, config, taskTracker });
    //     } catch (err) {
    //         res = err;
    //     }
    //     expect(res).to.include(expected);
    // });

    it('Expect not send message if epic key is in redis and status is not changed', async () => {
        const body = getPostEpicUpdatesData(noStatusChangedJSON);
        await redis.addToList(utils.getRedisEpicKey(epicIssueBody.id), body.data.id);

        const result = await postEpicUpdates({ chatApi, ...body, config, taskTracker });
        expect(chatSingle.sendHtmlMessage).not.to.be.called;
        expect(result).to.be.true;
    });
});
