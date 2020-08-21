import querystring from 'querystring';
import { fromString } from 'html-to-text';
import nock from 'nock';
import commentCreatedHook from '../fixtures/webhooks/comment/created.json';
import commentUpdatedHook from '../fixtures/webhooks/comment/updated.json';
import issueRenderedBody from '../fixtures/jira-api-requests/issue-rendered.json';
import gitlabCommentCreated from '../fixtures/webhooks/gitlab/commented.json';
import { getChatClass, taskTracker } from '../test-utils';
import { Jira } from '../../src/task-trackers/jira';
import { getCommentHTMLBody, PostComment } from '../../src/bot/actions/post-comment';
import { config } from '../../src/config';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { Gitlab } from '../../src/task-trackers/gitlab';
import projectsJson from '../fixtures/gitlab-api-requests/project-search.gitlab.json';
import gitlabIssueComments from '../fixtures/gitlab-api-requests/comments.json';
import { PostCommentData } from '../../src/types';
import { translate } from '../../src/locales';

const { expect } = chai;
chai.use(sinonChai);

describe('Post comments test', () => {
    describe('Jira api', () => {
        let chatApi;
        let chatSingle;
        let postComment: PostComment;

        const someError = 'Error!!!';
        const roomId = 'roomId';
        const postCommentData = taskTracker.parser.getPostCommentData(commentCreatedHook);
        const postCommentUpdatedData = taskTracker.parser.getPostCommentData(commentUpdatedHook);

        before(() => {
            nock(taskTracker.getRestUrl())
                .get(`/issue/${postCommentData.issueId}`)
                .query(Jira.expandParams)
                .times(2)
                .reply(200, issueRenderedBody)
                .get(`/issue/${postCommentUpdatedData.issueId}`)
                .query(Jira.expandParams)
                .reply(200, issueRenderedBody);
        });

        beforeEach(() => {
            const chatClass = getChatClass();
            chatSingle = chatClass.chatApiSingle;
            chatApi = chatClass.chatApi;
            chatSingle.getRoomId.withArgs(issueRenderedBody.key).resolves(roomId);

            postComment = new PostComment(config, taskTracker, chatApi);
        });

        after(() => {
            nock.cleanAll();
        });

        it('Expect postComment works correct with comment-created hook and no body in comments collection', async () => {
            const { headerText } = postCommentData;
            const commentBody = postCommentData.comment.body;
            const htmlBody = getCommentHTMLBody(headerText, commentBody);

            const result = await postComment.run(postCommentData);

            expect(result).to.be.true;
            expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomId, fromString(htmlBody), htmlBody);
        });

        it('Expect postComment works correct with comment-updated hook', async () => {
            const { headerText } = postCommentUpdatedData;
            const commentBody =
                issueRenderedBody.fields.comment.comments.find(el => el.id === postCommentData.comment.id)?.body ||
                postCommentData.comment.body;
            const htmlBody = getCommentHTMLBody(headerText, commentBody);
            const result = await postComment.run(postCommentUpdatedData);

            expect(result).to.be.true;
            expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomId, fromString(htmlBody), htmlBody);
        });

        it('Expect return with empty issueId. No way to handle issue', async () => {
            const res = await postComment.run({ ...postCommentData, issueId: null as any });
            expect(res).to.be.undefined;
        });

        it('Expect postComment throw error if room is not exists', async () => {
            chatSingle.getRoomId.withArgs(issueRenderedBody.key).throws(someError);
            try {
                await postComment.run(postCommentData);
            } catch (err) {
                expect(err).to.include(someError);
            }
        });
    });

    describe('Gitlab api', () => {
        let chatApi;
        let chatSingle;
        let postComment: PostComment;
        const gitlabTracker = new Gitlab({ ...config.taskTracker, features: config.features });

        const roomId = 'roomId';
        const postCommentData = gitlabTracker.parser.getPostCommentData(gitlabCommentCreated);

        beforeEach(() => {
            nock(gitlabTracker.getRestUrl())
                .get(`/projects/${querystring.escape(gitlabCommentCreated.project.path_with_namespace)}`)
                .reply(200, projectsJson)
                .get(`/projects/${projectsJson.id}/issues/${gitlabCommentCreated.issue.iid}/notes`)
                .reply(200, gitlabIssueComments);

            const chatClass = getChatClass({ alias: postCommentData.issueId });
            chatSingle = chatClass.chatApiSingle;
            chatApi = chatClass.chatApi;

            postComment = new PostComment(config, gitlabTracker, chatApi);
        });

        after(() => {
            nock.cleanAll();
        });

        it('postCommentData should equals correct body', () => {
            const expectedPostCommentData: PostCommentData = {
                author: gitlabCommentCreated.user.name,
                comment: {
                    body: gitlabCommentCreated.object_attributes.note,
                    id: gitlabCommentCreated.object_attributes.id,
                },
                headerText: translate('comment_created', {
                    name: `${gitlabCommentCreated.user.username} ${gitlabCommentCreated.user.name}`,
                }),
                issueId: gitlabCommentCreated.project.path_with_namespace + '-' + gitlabCommentCreated.issue.iid,
            };

            expect(postCommentData).to.be.deep.eq(expectedPostCommentData);
        });

        it('Expect postComment works correct with comment-created hook and no body in comments collection', async () => {
            const { headerText } = postCommentData;
            const commentBody = postCommentData.comment.body;
            const htmlBody = getCommentHTMLBody(headerText, commentBody);

            const result = await postComment.run(postCommentData);

            expect(result).to.be.true;
            expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomId, fromString(htmlBody), htmlBody);
        });
    });
});
