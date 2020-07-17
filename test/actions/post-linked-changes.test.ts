import marked from 'marked';
import { translate } from '../../src/locales';
import nock from 'nock';
import body from '../fixtures/webhooks/issue/updated/generic.json';
import issueJson from '../fixtures/jira-api-requests/issue.json';
import { PostLinkedChanges } from '../../src/bot/actions/post-linked-changes';
import { getChatClass, taskTracker, getAlias, getRoomId } from '../test-utils';
import { config } from '../../src/config';

import * as chai from 'chai';
import sinonChai from 'sinon-chai';
const { expect } = chai;
chai.use(sinonChai);

describe('Links changes test', () => {
    let chatSingle;
    let chatApi;
    let postLinkedChanges: PostLinkedChanges;

    const correctKey = getAlias();
    const roomId = getRoomId();
    const existKeyNotJoined = 'ROOOOM';

    const ignoreKey = 'IGNORE-123';
    const notExistKeyInChat = 'NO-ROOM-ID';

    const key = body.issue.key;
    const summary = body.issue.fields.summary;
    const status = taskTracker.selectors.getNewStatus(body);
    const name = taskTracker.selectors.getDisplayName(body);
    const viewUrl = taskTracker.getViewUrl(key);
    const expectedBody = translate('statusHasChanged', { key, summary, status });
    const expectedHTMLBody = marked(translate('statusHasChangedMessage', { name, key, summary, status, viewUrl }));

    beforeEach(() => {
        const chatClass = getChatClass({ joinedRooms: [correctKey] });
        chatSingle = chatClass.chatApiSingle;
        chatApi = chatClass.chatApi;
        postLinkedChanges = new PostLinkedChanges(config, taskTracker, chatApi);

        // chatApi = testUtils.getChatClass({ joinedRooms: [existKeyNotJoined] });
        nock(taskTracker.getRestUrl())
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
        const isLink = taskTracker.parser.isPostLinkedChanges(newBody);

        expect(isLink).to.be.false;
    });

    it('Expect error not to be thrown and no message to be sent if issuelinks are not available', async () => {
        const data = taskTracker.parser.getPostLinkedChangesData(body);
        const res = await postLinkedChanges.run({ ...data, linksKeys: [ignoreKey] });

        expect(res).to.be.true;
        expect(chatApi.getRoomIdForJoinedRoom).not.to.be.called;
        expect(chatSingle.sendHtmlMessage).not.to.be.called;
    });

    it('Expect all linked issues in projects which are available to be handled other to be ignored', async () => {
        const data = taskTracker.parser.getPostLinkedChangesData(body);
        const res = await postLinkedChanges.run({ ...data, linksKeys: [ignoreKey, correctKey] });

        expect(res).to.be.true;
        expect(chatApi.getRoomIdForJoinedRoom).to.be.calledOnce;
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomId, expectedBody, expectedHTMLBody);
    });

    it('Expect send status not to be sent if at least one of room is not found', async () => {
        const data = taskTracker.parser.getPostLinkedChangesData(body);
        let res;
        try {
            res = await postLinkedChanges.run({
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
        const data = taskTracker.parser.getPostLinkedChangesData(body);
        let res;
        try {
            res = await postLinkedChanges.run({
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
