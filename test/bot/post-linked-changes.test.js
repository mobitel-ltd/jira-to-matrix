const marked = require('marked');
const translate = require('../../src/locales');
const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const body = require('../fixtures/webhooks/issue/updated/generic.json');
const {getPostLinkedChangesData} = require('../../src/jira-hook-parser/parse-body.js');
const postLinkedChanges = require('../../src/bot/post-linked-changes.js');
const {isPostLinkedChanges} = require('../../src/jira-hook-parser/bot-handler.js');
const issueLinkJSON = require('../fixtures/jira-api-requests/issuelink.json');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('post New Links test', () => {
    const [linkId1, linkId2] = utils.getLinks(body).map(({id}) => id);
    const roomId = 'roomId';
    const key = utils.getKey(body);
    const summary = utils.getSummary(body);
    const status = utils.getStatus(body);
    const name = utils.getUserName(body);
    const issueRef = utils.getViewUrl(key);
    const expectedBody = translate('statusHasChanged', {key, summary, status});
    const expectedHTMLBody = marked(translate('statusHasChangedMessage', {name, key, summary, status, issueRef}));

    const mclient = {
        sendHtmlMessage: stub(),
        getRoomId: stub().resolves(roomId),
    };

    before(() => {
        nock(utils.getRestUrl(), {
            reqheaders: {
                Authorization: utils.auth(),
            },
        })
            .get(`/issueLink/${linkId1}`)
            .reply(200, {...issueLinkJSON, id: linkId1})
            .get(`/issueLink/${linkId2}`)
            .reply(200, {...issueLinkJSON, id: linkId2});
    });

    afterEach(() => {
        Object.values(mclient).map(val => val.resetHistory());
    });

    after(() => {
        nock.cleanAll();
    });

    it('Get links changes', async () => {
        const data = getPostLinkedChangesData(body);
        const result = await postLinkedChanges({mclient, ...data});

        expect(result).to.be.true;
        expect(mclient.sendHtmlMessage).to.be.calledWithExactly(roomId, expectedBody, expectedHTMLBody);
    });

    it('Get empty links', () => {
        const newBody = {...body, issue: {fields: {issuelinks: []}}};
        const isLink = isPostLinkedChanges(newBody);

        expect(isLink).to.be.false;
    });

    it('Expect send status not to be sent if at least one of room is not found', async () => {
        mclient.getRoomId.rejects();
        const data = getPostLinkedChangesData(body);
        let res;
        try {
            res = await postLinkedChanges({mclient, ...data});
        } catch (err) {
            res = err;
        }

        expect(res).to.include('Error in postLinkedChanges');
        expect(mclient.sendHtmlMessage).not.to.be.called;
    });
});
