import nock from 'nock';
import postNewLinksbody from '../fixtures/webhooks/issuelink/created.json';
import issueLinkBody from '../fixtures/jira-api-requests/issuelink.json';
import { redis } from '../../src/redis-client';
import { cleanRedis, getChatClass, taskTracker } from '../test-utils';
import { config } from '../../src/config';
import JSONBody from '../fixtures/webhooks/issue/updated/generic.json';
import issueBody from '../fixtures/jira-api-requests/issue.json';

import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { PostNewLinks } from '../../src/bot/actions/post-new-links';
import { errorTracing } from '../../src/lib/utils';
const { expect } = chai;
chai.use(sinonChai);

describe('Test postNewLinks', () => {
    let chatSingle;
    let postNewLinks: PostNewLinks;

    const issueLinkId = postNewLinksbody.issueLink.id;
    const roomIDIn = 'inId';
    const roomIDOut = 'outId';

    before(() => {
        nock(taskTracker.getRestUrl())
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
        const chatClass = getChatClass();
        chatSingle = chatClass.chatApiSingle;
        const chatApi = chatClass.chatApi;

        postNewLinks = new PostNewLinks(config, taskTracker, chatApi);

        chatSingle.getRoomId.withArgs(taskTracker.selectors.getInwardLinkKey(issueLinkBody)).resolves(roomIDIn);
        chatSingle.getRoomId.withArgs(taskTracker.selectors.getOutwardLinkKey(issueLinkBody)).resolves(roomIDOut);
    });

    afterEach(async () => {
        await cleanRedis();
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect return true after isPostNewLinks', () => {
        const res = taskTracker.parser.isPostNewLinks(postNewLinksbody);
        expect(res).to.be.true;
    });

    it('Expect result to be correct after handling parser', () => {
        const expected = { links: [issueLinkId] };
        const res = taskTracker.parser.getPostNewLinksData(postNewLinksbody);
        expect(res).to.be.deep.eq(expected);
    });

    it('Expect data to be handled by postNewLinks', async () => {
        const bodyIn = postNewLinks.getPostLinkMessageBody({
            relation: issueLinkBody.type.outward,
            related: issueLinkBody.outwardIssue,
        });
        const bodyOut = postNewLinks.getPostLinkMessageBody({
            relation: issueLinkBody.type.inward,
            related: issueLinkBody.inwardIssue,
        });

        const data = taskTracker.parser.getPostNewLinksData(postNewLinksbody);
        const res = await postNewLinks.run(data);

        expect(res).to.be.true;
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomIDIn, bodyIn.body, bodyIn.htmlBody);
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomIDOut, bodyOut.body, bodyOut.htmlBody);
    });

    it('Expect link not to be posted if it is already saved', async () => {
        await redis.isNewLink(issueLinkId);

        const data = taskTracker.parser.getPostNewLinksData(postNewLinksbody);
        const res = await postNewLinks.run(data);

        expect(res).to.be.true;
        expect(chatSingle.sendHtmlMessage).not.to.be.called;
    });

    it('Expect postnewlinks work correct with issue JSONBody', async () => {
        const bodyIn = postNewLinks.getPostLinkMessageBody({
            relation: issueLinkBody.type.outward,
            related: issueLinkBody.outwardIssue,
        });
        const bodyOut = postNewLinks.getPostLinkMessageBody({
            relation: issueLinkBody.type.inward,
            related: issueLinkBody.inwardIssue,
        });

        const data = taskTracker.parser.getPostNewLinksData(JSONBody);
        const res = await postNewLinks.run(data);
        expect(res).to.be.true;
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomIDIn, bodyIn.body, bodyIn.htmlBody);
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomIDOut, bodyOut.body, bodyOut.htmlBody);
    });

    it('Expect postlink throws error with expected data if smth wrong', async () => {
        let res;
        const data = taskTracker.parser.getPostNewLinksData(JSONBody);

        try {
            res = await postNewLinks.run(data);
        } catch (err) {
            res = err;
        }

        expect(res).includes(errorTracing('post new link'));
    });

    it('Expect data to be handled by postNewLinks if one of room is not available', async () => {
        nock.cleanAll();

        nock(taskTracker.getRestUrl())
            .get(`/issueLink/${issueLinkId}`)
            .reply(200, issueLinkBody)
            .get(`/issue/${issueLinkBody.inwardIssue.key}`)
            .reply(200, issueBody);

        const bodyIn = postNewLinks.getPostLinkMessageBody({
            relation: issueLinkBody.type.outward,
            related: issueLinkBody.outwardIssue,
        });

        const data = taskTracker.parser.getPostNewLinksData(postNewLinksbody);
        const res = await postNewLinks.run(data);

        expect(res).to.be.true;
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomIDIn, bodyIn.body, bodyIn.htmlBody);
        expect(chatSingle.sendHtmlMessage).to.be.calledOnce;
    });
});
