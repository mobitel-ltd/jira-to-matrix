const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const postNewLinksbody = require('../fixtures/webhooks/issuelink/created.json');
const issueLinkBody = require('../fixtures/jira-api-requests/issuelink.json');
const { getPostNewLinksData } = require('../../src/jira-hook-parser/parse-body.js');
const postNewLinks = require('../../src/bot/actions/post-new-links.js');
const { isPostNewLinks } = require('../../src/jira-hook-parser/bot-handler.js');
const { getPostLinkMessageBody } = require('../../src/bot/actions/helper');
const redis = require('../../src/redis-client.js');
const { cleanRedis, getChatApi } = require('../test-utils');
const JSONBody = require('../fixtures/webhooks/issue/updated/generic.json');
const issueBody = require('../fixtures/jira-api-requests/issue.json');

const chai = require('chai');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);

describe('Test postNewLinks', () => {
    let chatApi;

    const issueLinkId = postNewLinksbody.issueLink.id;
    const roomIDIn = 'inId';
    const roomIDOut = 'outId';

    before(() => {
        nock(utils.getRestUrl())
            .get(`/issueLink/${issueLinkId}`)
            .reply(200, issueLinkBody)
            .get(`/issueLink/${30137}`)
            .reply(200, issueLinkBody)
            .get(`/issueLink/${28516}`)
            .reply(200, issueLinkBody)
            .get(`/issue/${issueLinkBody.outwardIssue.key}`)
            .times(2)
            .reply(200, issueBody)
            .get(`/issue/${issueLinkBody.inwardIssue.key}`)
            .times(2)
            .reply(200, issueBody);
    });

    beforeEach(() => {
        chatApi = getChatApi();
        chatApi.getRoomId.withArgs(utils.getInwardLinkKey(issueLinkBody)).resolves(roomIDIn);
        chatApi.getRoomId.withArgs(utils.getOutwardLinkKey(issueLinkBody)).resolves(roomIDOut);
    });

    afterEach(async () => {
        await cleanRedis();
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect return true after isPostNewLinks', () => {
        const res = isPostNewLinks(postNewLinksbody);
        expect(res).to.be.true;
    });

    it('Expect result to be correct after handling parser', () => {
        const expected = { links: [issueLinkId] };
        const res = getPostNewLinksData(postNewLinksbody);
        expect(res).to.be.deep.eq(expected);
    });

    it('Expect data to be handled by postNewLinks', async () => {
        const bodyIn = getPostLinkMessageBody({
            relation: issueLinkBody.type.outward,
            related: issueLinkBody.outwardIssue,
        });
        const bodyOut = getPostLinkMessageBody({
            relation: issueLinkBody.type.inward,
            related: issueLinkBody.inwardIssue,
        });

        const data = getPostNewLinksData(postNewLinksbody);
        const res = await postNewLinks({ ...data, chatApi });

        expect(res).to.be.true;
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomIDIn, bodyIn.body, bodyIn.htmlBody);
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomIDOut, bodyOut.body, bodyOut.htmlBody);
    });

    it('Expect link not to be posted if it is already saved', async () => {
        await redis.isNewLink(issueLinkId);

        const data = getPostNewLinksData(postNewLinksbody);
        const res = await postNewLinks({ ...data, chatApi });

        expect(res).to.be.true;
        expect(chatApi.sendHtmlMessage).not.to.be.called;
    });

    it('Expect postnewlinks work correct with issue JSONBody', async () => {
        const bodyIn = getPostLinkMessageBody({
            relation: issueLinkBody.type.outward,
            related: issueLinkBody.outwardIssue,
        });
        const bodyOut = getPostLinkMessageBody({
            relation: issueLinkBody.type.inward,
            related: issueLinkBody.inwardIssue,
        });

        const data = getPostNewLinksData(JSONBody);
        const res = await postNewLinks({ ...data, chatApi });
        expect(res).to.be.true;
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomIDIn, bodyIn.body, bodyIn.htmlBody);
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomIDOut, bodyOut.body, bodyOut.htmlBody);
    });

    it('Expect postlink throws error with expected data if smth wrong', async () => {
        let res;
        const data = getPostNewLinksData(JSONBody);

        try {
            res = await postNewLinks({ ...data, chatApi });
        } catch (err) {
            res = err;
        }

        expect(res).includes(utils.errorTracing('post new link'));
    });

    it('Expect data to be handled by postNewLinks if one of room is not available', async () => {
        nock.cleanAll();

        nock(utils.getRestUrl())
            .get(`/issueLink/${issueLinkId}`)
            .reply(200, issueLinkBody)
            .get(`/issue/${issueLinkBody.inwardIssue.key}`)
            .reply(200, issueBody);

        const bodyIn = getPostLinkMessageBody({
            relation: issueLinkBody.type.outward,
            related: issueLinkBody.outwardIssue,
        });

        const data = getPostNewLinksData(postNewLinksbody);
        const res = await postNewLinks({ ...data, chatApi });

        expect(res).to.be.true;
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomIDIn, bodyIn.body, bodyIn.htmlBody);
        expect(chatApi.sendHtmlMessage).to.be.calledOnce;
    });
});
