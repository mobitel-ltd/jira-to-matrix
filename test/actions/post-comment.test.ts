import { fromString } from 'html-to-text';
import nock from 'nock';
import * as utils from '../../src/lib/utils';
import commentCreatedHook from '../fixtures/webhooks/comment/created.json';
import commentUpdatedHook from '../fixtures/webhooks/comment/updated.json';
import issueRenderedBody from '../fixtures/jira-api-requests/issue-rendered.json';
import { postComment } from '../../src/bot/actions';
import { getChatClass, taskTracker } from '../test-utils';

import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { Jira } from '../../src/task-trackers/jira';
import { getPostCommentData } from '../../src/jira-hook-parser/parse-body';
import { getCommentBody, getCommentHTMLBody } from '../../src/bot/actions/post-comment';
import { config } from '../../src/config';

const { expect } = chai;
chai.use(sinonChai);

describe('Post comments test', () => {
    let chatApi;
    let chatSingle;

    const someError = 'Error!!!';
    const roomId = 'roomId';
    const postCommentData = getPostCommentData(commentCreatedHook);
    const postCommentUpdatedData = getPostCommentData(commentUpdatedHook);

    before(() => {
        nock(utils.getRestUrl())
            .get(`/issue/${postCommentData.issueID}`)
            .query(Jira.expandParams)
            .times(2)
            .reply(200, issueRenderedBody)
            .get(`/issue/${postCommentUpdatedData.issueID}`)
            .query(Jira.expandParams)
            .reply(200, issueRenderedBody);
    });

    beforeEach(() => {
        const chatClass = getChatClass();
        chatSingle = chatClass.chatApiSingle;
        chatApi = chatClass.chatApi;
        chatSingle.getRoomId.withArgs(issueRenderedBody.key).resolves(roomId);
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect postComment works correct with comment-created hook', async () => {
        const { headerText } = postCommentData;
        const commentBody = getCommentBody(issueRenderedBody as any, postCommentData.comment);
        const htmlBody = getCommentHTMLBody(headerText, commentBody);

        const result = await postComment({ chatApi, ...postCommentData, config, taskTracker });

        expect(result).to.be.true;
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomId, fromString(htmlBody), htmlBody);
    });

    it('Expect postComment works correct with comment-updated hook', async () => {
        const { headerText } = postCommentUpdatedData;
        const commentBody = getCommentBody(issueRenderedBody as any, postCommentUpdatedData.comment);
        const htmlBody = getCommentHTMLBody(headerText, commentBody);
        const result = await postComment({ chatApi, ...postCommentUpdatedData, config, taskTracker });

        expect(result).to.be.true;
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomId, fromString(htmlBody), htmlBody);
    });

    it('Expect return with empty issueID. No way to handle issue', async () => {
        const res = await postComment({ chatApi, ...postCommentData, issueID: null as any, config, taskTracker });
        expect(res).to.be.undefined;
    });

    it('Expect postComment throw error if room is not exists', async () => {
        chatSingle.getRoomId.withArgs(issueRenderedBody.key).throws(someError);
        try {
            await postComment({ chatApi, ...postCommentData, config, taskTracker });
        } catch (err) {
            expect(err).to.include(someError);
        }
    });
});
