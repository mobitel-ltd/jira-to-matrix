const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const linkDeletedHook = require('../fixtures/webhooks/issuelink/deleted.json');
const issueLinkBody = require('../fixtures/jira-api-requests/issuelink.json');
const {getDeleteLinksData} = require('../../src/jira-hook-parser/parse-body.js');
const postLinksDeleted = require('../../src/bot/post-link-deleted');
const {isDeleteLinks} = require('../../src/jira-hook-parser/bot-handler.js');
const {getPostLinkMessageBody} = require('../../src/bot/helper');
const {cleanRedis} = require('../test-utils');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('Test postLinksDeleted', () => {
    const issueLinkId = linkDeletedHook.issueLink.id;
    const roomIDIn = 'inId';
    const roomIDOut = 'outId';
    const mclient = {
        sendHtmlMessage: stub(),
        getRoomId: stub(),
    };

    mclient.getRoomId.withArgs(utils.getInwardLinkKey(issueLinkBody)).resolves(roomIDIn);
    mclient.getRoomId.withArgs(utils.getOutwardLinkKey(issueLinkBody)).resolves(roomIDOut);

    before(() => {
        nock(utils.getRestUrl(), {
            reqheaders: {
                Authorization: utils.auth(),
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

    it('Expect return true after isDeleteLinks', () => {
        const res = isDeleteLinks(linkDeletedHook);
        expect(res).to.be.true;
    });

    it('Expect result to be correct after handling parser', () => {
        const expected = {links: [issueLinkId]};
        const res = getDeleteLinksData(linkDeletedHook);
        expect(res).to.be.deep.eq(expected);
    });

    it('Expect data to be handled by postLinksDeleted', async () => {
        const bodyIn = getPostLinkMessageBody({
            relation: issueLinkBody.type.outward,
            related: issueLinkBody.outwardIssue,
        }, 'deleteLink');
        const bodyOut = getPostLinkMessageBody({
            relation: issueLinkBody.type.inward,
            related: issueLinkBody.inwardIssue,
        }, 'deleteLink');

        const data = getDeleteLinksData(linkDeletedHook);
        const res = await postLinksDeleted({...data, mclient});

        expect(res).to.be.true;
        expect(mclient.sendHtmlMessage).to.be.calledWithExactly(roomIDIn, bodyIn.body, bodyIn.htmlBody);
        expect(mclient.sendHtmlMessage).to.be.calledWithExactly(roomIDOut, bodyOut.body, bodyOut.htmlBody);
    });
});
