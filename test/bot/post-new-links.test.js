const nock = require('nock');
const {auth, getRestUrl, getInwardLinkKey, getOutwardLinkKey} = require('../../src/lib/utils.js');
const postNewLinksbody = require('../fixtures/webhooks/issuelink/created.json');
const issueLinkBody = require('../fixtures/jira-api-requests/issuelink.json');
const {getPostNewLinksData} = require('../../src/jira-hook-parser/parse-body.js');
const postNewLinks = require('../../src/bot/post-new-links.js');
const {isPostNewLinks} = require('../../src/jira-hook-parser/bot-handler.js');
const {getPostLinkMessageBody} = require('../../src/bot/helper');
const redis = require('../../src/redis-client.js');
const {cleanRedis} = require('../test-utils');
const body = require('../fixtures/webhooks/issue/updated/generic.json');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('Test postNewLinks', () => {
    const issueLinkId = postNewLinksbody.issueLink.id;
    const roomIDIn = 'inId';
    const roomIDOut = 'outId';
    const mclient = {
        sendHtmlMessage: stub(),
        getRoomId: stub(),
    };

    mclient.getRoomId.withArgs(getInwardLinkKey(issueLinkBody)).resolves(roomIDIn);
    mclient.getRoomId.withArgs(getOutwardLinkKey(issueLinkBody)).resolves(roomIDOut);

    before(() => {
        nock(getRestUrl(), {
            reqheaders: {
                Authorization: auth(),
            },
        })
            .get(`/issueLink/${issueLinkId}`)
            .reply(200, issueLinkBody)
            .get(`/issueLink/${30137}`)
            .reply(200, issueLinkBody)
            .get(`/issueLink/${28516}`)
            .reply(200, issueLinkBody);
    });

    afterEach(async () => {
        Object.values(mclient).map(val => val.resetHistory());
        await cleanRedis();
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect body is true after isPostNewLinks', () => {
        const res = isPostNewLinks(postNewLinksbody);
        expect(res).to.be.true;
    });

    it('Expect body to be correct after handling parser', () => {
        const expected = {links: [issueLinkId]};
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
        const res = await postNewLinks({...data, mclient});

        expect(res).to.be.true;
        expect(mclient.sendHtmlMessage).to.be.calledWithExactly(roomIDIn, bodyIn.body, bodyIn.htmlBody);
        expect(mclient.sendHtmlMessage).to.be.calledWithExactly(roomIDOut, bodyOut.body, bodyOut.htmlBody);
    });

    it('Expect link not to be posted if it is already saved', async () => {
        await redis.isNewLink(issueLinkId);

        const data = getPostNewLinksData(postNewLinksbody);
        const res = await postNewLinks({...data, mclient});

        expect(res).to.be.true;
        expect(mclient.sendHtmlMessage).not.to.be.called;
    });

    it('Expect postnewlinks work correct with issue body', async () => {
        const bodyIn = getPostLinkMessageBody({
            relation: issueLinkBody.type.outward,
            related: issueLinkBody.outwardIssue,
        });
        const bodyOut = getPostLinkMessageBody({
            relation: issueLinkBody.type.inward,
            related: issueLinkBody.inwardIssue,
        });

        const data = getPostNewLinksData(body);
        const res = await postNewLinks({...data, mclient});
        expect(res).to.be.true;
        expect(mclient.sendHtmlMessage).to.be.calledWithExactly(roomIDIn, bodyIn.body, bodyIn.htmlBody);
        expect(mclient.sendHtmlMessage).to.be.calledWithExactly(roomIDOut, bodyOut.body, bodyOut.htmlBody);
    });
});
