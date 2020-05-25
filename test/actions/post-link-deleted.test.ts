import * as faker from 'faker';
import nock from 'nock';
import * as utils from '../../src/lib/utils';
import linkDeletedHook from '../fixtures/webhooks/issuelink/deleted.json';
import issueBody from '../fixtures/jira-api-requests/issue.json';
import { getPostLinksDeletedData } from '../../src/jira-hook-parser/parsers/jira/parse-body';
import { postLinksDeleted } from '../../src/bot/actions/post-link-deleted';
import { isDeleteLinks } from '../../src/jira-hook-parser/parsers/jira';
import { getPostLinkMessageBody } from '../../src/bot/actions/helper';
import { translate } from '../../src/locales';
import marked from 'marked';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { cleanRedis, getChatClass, taskTracker } from '../test-utils';
import { config } from '../../src/config';

const { expect } = chai;
chai.use(sinonChai);

describe('Test postLinksDeleted', () => {
    let chatSingle;
    let options;

    const { sourceIssueId } = linkDeletedHook.issueLink;
    const { destinationIssueId } = linkDeletedHook.issueLink;

    const roomIDIn = 'inId';
    const roomIDOut = 'outId';

    beforeEach(() => {
        const chatClass = getChatClass();
        chatSingle = chatClass.chatApiSingle;
        const chatApi = chatClass.chatApi;

        chatSingle.getRoomId
            .withArgs(utils.getKey(issueBody))
            .onFirstCall()
            .resolves(roomIDIn);
        chatSingle.getRoomId.onSecondCall(utils.getKey(issueBody)).resolves(roomIDOut);
        nock(utils.getRestUrl())
            .get(`/issue/${sourceIssueId}`)
            .reply(200, issueBody)
            .get(`/issue/${destinationIssueId}`)
            .reply(200, issueBody);

        options = { taskTracker, config, chatApi };
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
        const res = await postLinksDeleted({ ...data, ...options });

        expect(res).to.be.true;
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomIDIn, bodyIn.body, bodyIn.htmlBody);
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomIDOut, bodyOut.body, bodyOut.htmlBody);
    });

    it('Expect postlink correct works if one of issue id in link is not available', async () => {
        nock.cleanAll();
        const issueId = faker.random.arrayElement([sourceIssueId, destinationIssueId]);
        nock(utils.getRestUrl())
            .get(`/issue/${issueId}`)
            .reply(200, issueBody);

        const expectedPost = translate('deleteLink');
        const data = getPostLinksDeletedData(linkDeletedHook);
        const res = await postLinksDeleted({ ...data, ...options });

        expect(res).to.be.true;
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomIDIn, expectedPost, marked(expectedPost));
    });

    it('Expect send status not to be sent if at least one of room is not found', async () => {
        chatSingle.getRoomId.onSecondCall().rejects();
        const data = getPostLinksDeletedData(linkDeletedHook);
        let res;
        try {
            res = await postLinksDeleted({ ...data, ...options });
        } catch (err) {
            res = err;
        }

        expect(chatSingle.sendHtmlMessage).not.to.be.called;
        expect(res).to.include('Error in post delete link');
    });
});
