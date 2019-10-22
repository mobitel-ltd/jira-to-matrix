const faker = require('faker');
const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const linkDeletedHook = require('../fixtures/webhooks/issuelink/deleted.json');
const issueBody = require('../fixtures/jira-api-requests/issue.json');
const { getPostLinksDeletedData } = require('../../src/jira-hook-parser/parse-body.js');
const postLinksDeleted = require('../../src/bot/actions/post-link-deleted');
const { isDeleteLinks } = require('../../src/jira-hook-parser/bot-handler.js');
const { getPostLinkMessageBody } = require('../../src/bot/actions/helper');
const { cleanRedis, getChatApi } = require('../test-utils');
const translate = require('../../src/locales');
const marked = require('marked');

const chai = require('chai');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);

describe('Test postLinksDeleted', () => {
    let chatApi;
    const { sourceIssueId } = linkDeletedHook.issueLink;
    const { destinationIssueId } = linkDeletedHook.issueLink;

    const roomIDIn = 'inId';
    const roomIDOut = 'outId';

    beforeEach(() => {
        chatApi = getChatApi();
        chatApi.getRoomId
            .withArgs(utils.getKey(issueBody))
            .onFirstCall()
            .resolves(roomIDIn);
        chatApi.getRoomId.onSecondCall(utils.getKey(issueBody)).resolves(roomIDOut);
        nock(utils.getRestUrl())
            .get(`/issue/${sourceIssueId}`)
            .reply(200, issueBody)
            .get(`/issue/${destinationIssueId}`)
            .reply(200, issueBody);
    });

    afterEach(async () => {
        await cleanRedis();
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
        const bodyIn = getPostLinkMessageBody(
            {
                relation: linkDeletedHook.issueLink.issueLinkType.outwardName,
                related: issueBody,
            },
            'deleteLink',
        );
        const bodyOut = getPostLinkMessageBody(
            {
                relation: linkDeletedHook.issueLink.issueLinkType.inwardName,
                related: issueBody,
            },
            'deleteLink',
        );

        const data = getPostLinksDeletedData(linkDeletedHook);
        const res = await postLinksDeleted({ ...data, chatApi });

        expect(res).to.be.true;
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomIDIn, bodyIn.body, bodyIn.htmlBody);
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomIDOut, bodyOut.body, bodyOut.htmlBody);
    });

    it('Expect postlink correct works if one of issue id in link is not available', async () => {
        nock.cleanAll();
        const issueId = faker.random.arrayElement([sourceIssueId, destinationIssueId]);
        nock(utils.getRestUrl())
            .get(`/issue/${issueId}`)
            .reply(200, issueBody);

        const expectedPost = translate('deleteLink');
        const data = getPostLinksDeletedData(linkDeletedHook);
        const res = await postLinksDeleted({ ...data, chatApi });

        expect(res).to.be.true;
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomIDIn, expectedPost, marked(expectedPost));
    });

    it('Expect send status not to be sent if at least one of room is not found', async () => {
        chatApi.getRoomId.onSecondCall().rejects();
        const data = getPostLinksDeletedData(linkDeletedHook);
        let res;
        try {
            res = await postLinksDeleted({ ...data, chatApi });
        } catch (err) {
            res = err;
        }

        expect(chatApi.sendHtmlMessage).not.to.be.called;
        expect(res).to.include('Error in post delete link');
    });
});
