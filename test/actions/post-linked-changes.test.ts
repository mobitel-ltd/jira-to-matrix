import marked from 'marked';
import { translate } from '../../src/locales';
import nock from 'nock';
import * as utils from '../../src/lib/utils';
import body from '../fixtures/webhooks/issue/updated/generic.json';
import issueJson from '../fixtures/jira-api-requests/issue.json';
import { getPostLinkedChangesData } from '../../src/hook-parser/parsers/jira/parse-body';
import { postLinkedChanges } from '../../src/bot/actions/post-linked-changes';
import { isPostLinkedChanges } from '../../src/hook-parser/parsers/jira';
import { getChatClass, taskTracker, getAlias, getRoomId } from '../test-utils';
import { config } from '../../src/config';

import * as chai from 'chai';
import sinonChai from 'sinon-chai';
const { expect } = chai;
chai.use(sinonChai);

describe('Links changes test', () => {
    let chatSingle;
    let chatApi;
    let options;

    const correctKey = getAlias();
    const roomId = getRoomId();
    const existKeyNotJoined = 'ROOOOM';

    const ignoreKey = 'IGNORE-123';
    const notExistKeyInChat = 'NO-ROOM-ID';

    const key = utils.getKey(body);
    const summary = utils.getSummary(body);
    const status = utils.getNewStatus(body);
    const name = utils.getDisplayName(body);
    const viewUrl = utils.getViewUrl(key);
    const expectedBody = translate('statusHasChanged', { key, summary, status });
    const expectedHTMLBody = marked(translate('statusHasChangedMessage', { name, key, summary, status, viewUrl }));

    beforeEach(() => {
        const chatClass = getChatClass({ joinedRooms: [correctKey] });
        chatSingle = chatClass.chatApiSingle;
        chatApi = chatClass.chatApi;
        options = { taskTracker, config, chatApi };

        // chatApi = testUtils.getChatClass({ joinedRooms: [existKeyNotJoined] });
        nock(utils.getRestUrl())
            .get(`/issue/${correctKey}`)
            .reply(200, issueJson)
            .get(`/issue/${notExistKeyInChat}`)
            .reply(200, issueJson)
            .get(`/issue/${existKeyNotJoined}`)
            .reply(200, issueJson);
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it('Get empty links', () => {
        const newBody = { ...body, issue: { fields: { issuelinks: [] } } };
        const isLink = isPostLinkedChanges(newBody);

        expect(isLink).to.be.false;
    });

    it('Expect error not to be thrown and no message to be sent if issuelinks are not available', async () => {
        const data = getPostLinkedChangesData(body);
        const res = await postLinkedChanges({ ...options, ...data, linksKeys: [ignoreKey] });

        expect(res).to.be.true;
        expect(chatApi.getRoomIdForJoinedRoom).not.to.be.called;
        expect(chatSingle.sendHtmlMessage).not.to.be.called;
    });

    it('Expect all linked issues in projects which are available to be handled other to be ignored', async () => {
        const data = getPostLinkedChangesData(body);
        const res = await postLinkedChanges({ ...options, ...data, linksKeys: [ignoreKey, correctKey] });

        expect(res).to.be.true;
        expect(chatApi.getRoomIdForJoinedRoom).to.be.calledOnce;
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomId, expectedBody, expectedHTMLBody);
    });

    it('Expect send status not to be sent if at least one of room is not found', async () => {
        const data = getPostLinkedChangesData(body);
        let res;
        try {
            res = await postLinkedChanges({
                ...options,
                ...data,
                linksKeys: [correctKey, ignoreKey, notExistKeyInChat],
            });
        } catch (err) {
            res = err;
        }

        expect(chatSingle.sendHtmlMessage).not.to.be.called;
        expect(res).to.include('Error in postLinkedChanges');
    });

    it('Expect send status not to be sent if at least one of room is found but bot is NOT in room', async () => {
        const data = getPostLinkedChangesData(body);
        let res;
        try {
            res = await postLinkedChanges({
                ...options,
                ...data,
                linksKeys: [correctKey, existKeyNotJoined],
            });
        } catch (err) {
            res = err;
        }

        expect(chatSingle.sendHtmlMessage).not.to.be.called;
        expect(res).to.include('Error in postLinkedChanges');
    });
});

// const checkedIssues = await Promise.all(linksKeys.map(async key => {
//     const issue = await taskTracker.getIssueSafety(key);

//     return issue && key;
// }));
