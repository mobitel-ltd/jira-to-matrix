const faker = require('faker');
const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const linkDeletedHook = require('../fixtures/webhooks/issuelink/deleted.json');
const issueBody = require('../fixtures/jira-api-requests/issue.json');
const {getPostLinksDeletedData} = require('../../src/jira-hook-parser/parse-body.js');
const postLinksDeleted = require('../../src/bot/actions/post-link-deleted');
const {isDeleteLinks} = require('../../src/jira-hook-parser/bot-handler.js');
const {getPostLinkMessageBody} = require('../../src/bot/actions/helper');
const {cleanRedis} = require('../test-utils');
const translate = require('../../src/locales');
const marked = require('marked');

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('Test postLinksDeleted', () => {
    const {sourceIssueId} = linkDeletedHook.issueLink;
    const {destinationIssueId} = linkDeletedHook.issueLink;

    const roomIDIn = 'inId';
    const roomIDOut = 'outId';
    const chatApi = {
        sendHtmlMessage: stub(),
        getRoomId: stub(),
    };

    chatApi.getRoomId.withArgs(utils.getKey(issueBody)).onFirstCall().resolves(roomIDIn);
    chatApi.getRoomId.onSecondCall(utils.getKey(issueBody)).resolves(roomIDOut);

    before(() => {
        nock(utils.getRestUrl())
            .get(`/issue/${sourceIssueId}`)
            .reply(200, issueBody)
            .get(`/issue/${destinationIssueId}`)
            .reply(200, issueBody);
    });

    afterEach(async () => {
        Object.values(chatApi).map(val => val.resetHistory());
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
        const expected = {
            sourceIssueId,
            destinationIssueId,
            sourceRelation: linkDeletedHook.issueLink.issueLinkType.outwardName,
            destinationRelation: linkDeletedHook.issueLink.issueLinkType.inwardName,
        };
        const res = getPostLinksDeletedData(linkDeletedHook);
        expect(res).to.be.deep.eq(expected);
    });

    it('Expect data to be handled by postLinksDeleted', async () => {
        const bodyIn = getPostLinkMessageBody({
            relation: linkDeletedHook.issueLink.issueLinkType.outwardName,
            related: issueBody,
        }, 'deleteLink');
        const bodyOut = getPostLinkMessageBody({
            relation: linkDeletedHook.issueLink.issueLinkType.inwardName,
            related: issueBody,
        }, 'deleteLink');

        const data = getPostLinksDeletedData(linkDeletedHook);
        const res = await postLinksDeleted({...data, chatApi});

        expect(res).to.be.true;
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomIDIn, bodyIn.body, bodyIn.htmlBody);
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomIDOut, bodyOut.body, bodyOut.htmlBody);
    });

    it('Expect postlink throws error with expected data if smth wrong', async () => {
        let res;
        const data = getPostLinksDeletedData(linkDeletedHook);

        try {
            res = await postLinksDeleted({...data, chatApi});
        } catch (err) {
            res = err;
        }

        expect(res).includes(utils.errorTracing('post delete link'));
    });

    it('Expect postlink correct works if one of issue id in link is not available', async () => {
        nock.cleanAll();
        const issueId = faker.random.arrayElement([sourceIssueId, destinationIssueId]);
        nock(utils.getRestUrl())
            .get(`/issue/${issueId}`)
            .reply(200, issueBody);

        const expectedPost = translate('deleteLink');
        const data = getPostLinksDeletedData(linkDeletedHook);
        const res = await postLinksDeleted({...data, chatApi});

        expect(res).to.be.true;
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomIDIn, expectedPost, marked(expectedPost));
    });
});
