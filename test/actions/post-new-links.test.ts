import nock from 'nock';
import * as utils from '../../src/lib/utils';
import postNewLinksbody from '../fixtures/webhooks/issuelink/created.json';
import issueLinkBody from '../fixtures/jira-api-requests/issuelink.json';
import { getPostNewLinksData } from '../../src/hook-parser/parsers/jira/parse-body';
import { postNewLinks } from '../../src/bot/actions/post-new-links';
import { isPostNewLinks } from '../../src/hook-parser/parsers/jira';
import { getPostLinkMessageBody } from '../../src/bot/actions/helper';
import { redis } from '../../src/redis-client';
import { cleanRedis, getChatClass, taskTracker } from '../test-utils';
import { config } from '../../src/config';
import JSONBody from '../fixtures/webhooks/issue/updated/generic.json';
import issueBody from '../fixtures/jira-api-requests/issue.json';

import * as chai from 'chai';
import sinonChai from 'sinon-chai';
const { expect } = chai;
chai.use(sinonChai);

describe('Test postNewLinks', () => {
    let chatSingle;
    let options;

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
        const chatClass = getChatClass();
        chatSingle = chatClass.chatApiSingle;
        const chatApi = chatClass.chatApi;

        options = { taskTracker, config, chatApi };

        chatSingle.getRoomId.withArgs(utils.getInwardLinkKey(issueLinkBody)).resolves(roomIDIn);
        chatSingle.getRoomId.withArgs(utils.getOutwardLinkKey(issueLinkBody)).resolves(roomIDOut);
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
        const res = await postNewLinks({ ...data, ...options });

        expect(res).to.be.true;
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomIDIn, bodyIn.body, bodyIn.htmlBody);
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomIDOut, bodyOut.body, bodyOut.htmlBody);
    });

    it('Expect link not to be posted if it is already saved', async () => {
        await redis.isNewLink(issueLinkId);

        const data = getPostNewLinksData(postNewLinksbody);
        const res = await postNewLinks({ ...data, ...options });

        expect(res).to.be.true;
        expect(chatSingle.sendHtmlMessage).not.to.be.called;
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
        const res = await postNewLinks({ ...data, ...options });
        expect(res).to.be.true;
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomIDIn, bodyIn.body, bodyIn.htmlBody);
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomIDOut, bodyOut.body, bodyOut.htmlBody);
    });

    it('Expect postlink throws error with expected data if smth wrong', async () => {
        let res;
        const data = getPostNewLinksData(JSONBody);

        try {
            res = await postNewLinks({ ...data, ...options });
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
        const res = await postNewLinks({ ...data, ...options });

        expect(res).to.be.true;
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomIDIn, bodyIn.body, bodyIn.htmlBody);
        expect(chatSingle.sendHtmlMessage).to.be.calledOnce;
    });
});
