const htmlToString = require('html-to-text').fromString;
const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const botHelper = require('../../src/bot/actions/helper');
const commentCreatedHook = require('../fixtures/webhooks/comment/created.json');
const commentUpdatedHook = require('../fixtures/webhooks/comment/updated.json');
const issueRenderedBody = require('../fixtures/jira-api-requests/issue-rendered.json');
const parser = require('../../src/jira-hook-parser/parse-body.js');
const {postComment} = require('../../src/bot/actions');
const testUtils = require('../test-utils');

const chai = require('chai');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('Post comments test', () => {
    let chatApi;

    const someError = 'Error!!!';
    const roomId = 'roomId';
    const postCommentData = parser.getPostCommentData(commentCreatedHook);
    const postCommentUpdatedData = parser.getPostCommentData(commentUpdatedHook);

    before(() => {
        nock(utils.getRestUrl(), {
            reqheaders: {Authorization: utils.auth()},
        })
            .get(`/issue/${postCommentData.issueID}`)
            .query(utils.expandParams)
            .times(2)
            .reply(200, issueRenderedBody)
            .get(`/issue/${postCommentUpdatedData.issueID}`)
            .query(utils.expandParams)
            .reply(200, issueRenderedBody);
    });

    beforeEach(() => {
        chatApi = testUtils.getChatApi();
        chatApi.getRoomId.withArgs(issueRenderedBody.key).resolves(roomId);
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect postComment works correct with comment-created hook', async () => {
        const {headerText} = postCommentData;
        const commentBody = botHelper.getCommentBody(issueRenderedBody, postCommentData.comment);
        const htmlBody = botHelper.getCommentHTMLBody(headerText, commentBody);

        const result = await postComment({chatApi, ...postCommentData});

        expect(result).to.be.true;
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, htmlToString(htmlBody), htmlBody);
    });

    it('Expect postComment works correct with comment-updated hook', async () => {
        const {headerText} = postCommentUpdatedData;
        const commentBody = botHelper.getCommentBody(issueRenderedBody, postCommentUpdatedData.comment);
        const htmlBody = botHelper.getCommentHTMLBody(headerText, commentBody);
        const result = await postComment({chatApi, ...postCommentUpdatedData});

        expect(result).to.be.true;
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, htmlToString(htmlBody), htmlBody);
    });

    it('Expect return with empty issueID. No way to handle issue', async () => {
        const res = await postComment({chatApi, ...postCommentData, issueID: null});
        expect(res).to.be.undefined;
    });

    it('Expect postComment throw error if room is not exists', async () => {
        chatApi.getRoomId.withArgs(issueRenderedBody.key).throws(someError);
        try {
            await postComment({chatApi, ...postCommentData});
        } catch (err) {
            expect(err).to.include(someError);
        }
    });
});
