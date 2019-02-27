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
    const ignoredIssue = 'IGNORE-123';
    const availableIssue = 'AVAILABLE-123';

    const roomId = 'roomId';
    const key = utils.getKey(body);
    const summary = utils.getSummary(body);
    const status = utils.getNewStatus(body);
    const name = utils.getUserName(body);
    const viewUrl = utils.getViewUrl(key);
    const expectedBody = translate('statusHasChanged', {key, summary, status});
    const expectedHTMLBody = marked(translate('statusHasChangedMessage', {name, key, summary, status, viewUrl}));

    const chatApi = {
        sendHtmlMessage: stub(),
        getRoomId: stub().resolves(roomId),
    };

    before(() => {
        nock(utils.getRestUrl())
            .get(`/issue/${availableIssue}`)
            .times(3)
            .reply(200, issueJson);
    });

    afterEach(() => {
        Object.values(chatApi).map(val => val.resetHistory());
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
        const res = await postLinkedChanges({chatApi, ...data, linksKeys: [ignoredIssue]});

        expect(res).to.be.true;
        expect(chatApi.getRoomId).not.to.be.called;
        expect(chatApi.sendHtmlMessage).not.to.be.called;
    });

    it('Expect all linked issues in projects which are available to be handled other to be ignored', async () => {
        const data = getPostLinkedChangesData(body);
        const res = await postLinkedChanges({chatApi, ...data, linksKeys: [ignoredIssue, availableIssue]});

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
                linksKeys: Array.from({length: 10}, () => availableIssue),
            });
        } catch (err) {
            res = err;
        }

        expect(chatApi.sendHtmlMessage).not.to.be.called;
        expect(res).to.include('Error in postLinkedChanges');
    });
});
