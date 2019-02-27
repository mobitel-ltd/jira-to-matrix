const marked = require('marked');
const translate = require('../../src/locales');
const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const body = require('../fixtures/webhooks/issue/updated/generic.json');
const {getPostLinkedChangesData} = require('../../src/jira-hook-parser/parse-body.js');
const postLinkedChanges = require('../../src/bot/actions/post-linked-changes.js');
const {isPostLinkedChanges} = require('../../src/jira-hook-parser/bot-handler.js');
const issueJson = require('../fixtures/jira-api-requests/issue.json');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('post New Links test', () => {
    const ignoreKey = 'IGNORE-123';
    const correctKey = 'AVAILABLE-123';

    const roomId = 'roomId';
    const key = utils.getKey(body);
    const summary = utils.getSummary(body);
    const status = utils.getNewStatus(body);
    const name = utils.getUserName(body);
    const viewUrl = utils.getViewUrl(key);
    const expectedBody = translate('statusHasChanged', {key, summary, status});
    const expectedHTMLBody = marked(translate('statusHasChangedMessage', {name, key, summary, status, viewUrl}));

    let chatApi;

    before(() => {
        nock(utils.getRestUrl())
            .get(`/issue/${correctKey}`)
            .times(3)
            .reply(200, issueJson);
    });

    beforeEach(() => {
        const getRoomId = stub().callsFake(arg => {
            if (arg === correctKey) {
                return new Promise(res => res(roomId));
            }
            throw 'Error';
        });
        chatApi = {sendHtmlMessage: stub(), getRoomId};
    });

    afterEach(() => {
        Object.values(chatApi).map(val => val.reset());
    });

    after(() => {
        nock.cleanAll();
    });

    it('Get empty links', () => {
        const newBody = {...body, issue: {fields: {issuelinks: []}}};
        const isLink = isPostLinkedChanges(newBody);

        expect(isLink).to.be.false;
    });

    it('Expect error not to be thrown and no message to be sent if issuelinks are not available', async () => {
        const data = getPostLinkedChangesData(body);
        const res = await postLinkedChanges({chatApi, ...data, linksKeys: [ignoreKey]});

        expect(res).to.be.true;
        expect(chatApi.getRoomId).not.to.be.called;
        expect(chatApi.sendHtmlMessage).not.to.be.called;
    });

    it('Expect all linked issues in projects which are available to be handled other to be ignored', async () => {
        const data = getPostLinkedChangesData(body);
        const res = await postLinkedChanges({chatApi, ...data, linksKeys: [ignoreKey, correctKey]});

        expect(res).to.be.true;
        expect(chatApi.getRoomId).to.be.calledOnce;
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, expectedBody, expectedHTMLBody);
    });

    it('Expect send status not to be sent if at least one of room is not found', async () => {
        chatApi.getRoomId.onSecondCall().rejects();
        const data = getPostLinkedChangesData(body);
        let res;
        try {
            res = await postLinkedChanges({
                chatApi, ...data,
                linksKeys: Array.from({length: 10}, () => correctKey),
            });
        } catch (err) {
            res = err;
        }

        expect(chatApi.sendHtmlMessage).not.to.be.called;
        expect(res).to.include('Error in postLinkedChanges');
    });
});

// const checkedIssues = await Promise.all(linksKeys.map(async key => {
//     const issue = await jiraRequests.getIssueSafety(key);

//     return issue && key;
// }));
