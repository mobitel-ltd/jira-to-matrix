import marked from 'marked';
import querystring from 'querystring';
import { config } from '../../src/config';
import nock from 'nock';
import * as chai from 'chai';
import { translate } from '../../src/locales';
import sinonChai from 'sinon-chai';
import { getChatClass, cleanRedis } from '../test-utils';
import { Gitlab } from '../../src/task-trackers/gitlab';
import createdIssue from '../fixtures/webhooks/gitlab/issue/created.json';
import milestoneDeleted from '../fixtures/webhooks/gitlab/issue/milestone-deleted.json';
import milestoneUpdated from '../fixtures/webhooks/gitlab/issue/milestone-updated.json';
import issueClosed from '../fixtures/webhooks/gitlab/issue/closed.json';
import gitlabIssueJson from '../fixtures/gitlab-api-requests/issue.json';
import { PostMilestoneUpdates } from '../../src/bot/actions/post-milestone-updates';
import gitlabProjectJson from '../fixtures/gitlab-api-requests/project-search.gitlab.json';
import milestoneIssuesJson from '../fixtures/gitlab-api-requests/milestone-issue.json';
import issueReopen from '../fixtures/webhooks/gitlab/issue/reopened.json';

const { expect } = chai;

chai.use(sinonChai);

describe('PostMilestoneUpdates', () => {
    let gitlabTracker: Gitlab;
    let chatApi;
    let chatSingle;
    let postMilestoneUpdates: PostMilestoneUpdates;
    const roomId = '!abcdefg:matrix';

    beforeEach(() => {
        gitlabTracker = new Gitlab({
            url: 'https://gitlab.test-example.ru',
            user: 'gitlab_bot',
            password: 'fakepasswprd',
            features: config.features,
        });
    });

    afterEach(async () => {
        await cleanRedis();
        nock.cleanAll();
    });

    describe('Issue added', () => {
        beforeEach(() => {
            nock(gitlabTracker.getRestUrl())
                .get(`/groups/${gitlabIssueJson.milestone.group_id}/milestones/${gitlabIssueJson.milestone.id}/issues`)
                .times(3)
                .reply(200, milestoneIssuesJson)
                .get(`/projects/${querystring.escape(createdIssue.project.path_with_namespace)}`)
                .times(6)
                .reply(200, gitlabProjectJson)
                .get(`/projects/${gitlabProjectJson.id}/issues/${createdIssue.object_attributes.iid}`)
                .times(3)
                .reply(200, gitlabIssueJson)
                .get(`/projects/${gitlabProjectJson.id}/issues/${issueReopen.object_attributes.iid}`)
                .reply(200, gitlabIssueJson)
                .get(`/projects/${gitlabProjectJson.id}/issues/${issueClosed.object_attributes.iid}`)
                .reply(200, gitlabIssueJson);

            const chatClass = getChatClass({ roomId });
            chatApi = chatClass.chatApi;
            chatSingle = chatClass.chatApiSingle;
            chatSingle.getRoomId.resolves(roomId);

            postMilestoneUpdates = new PostMilestoneUpdates(config, gitlabTracker, chatApi);
        });

        it('Should send message to milestone room with info about added issue', async () => {
            const updateData = gitlabTracker.parser.getPostMilestoneUpdatesData(createdIssue);
            const result = await postMilestoneUpdates.run(updateData);

            const message = translate('issueAddedToMilestone', {
                viewUrl: gitlabTracker.getViewUrl(updateData.issueKey),
                summary: createdIssue.object_attributes.title,
                user: createdIssue.user.name,
            });
            const expectedData = [roomId, message, marked(message)];

            expect(result).to.be.eq(message);
            expect(chatSingle.sendHtmlMessage).have.to.be.calledWithExactly(...expectedData);
        });

        it('Should not send message to milestone room with info about added issue if it was already post', async () => {
            const updateData = gitlabTracker.parser.getPostMilestoneUpdatesData(createdIssue);
            await postMilestoneUpdates.run(updateData);
            const result = await postMilestoneUpdates.run(updateData);

            const message = PostMilestoneUpdates.alreadyAddedToMilestoneMessage(
                updateData.issueKey,
                gitlabTracker.selectors.getMilestoneKey(gitlabIssueJson as any, updateData.milestoneId),
            );

            expect(result).to.be.eq(message);
        });

        it('Should send message to milestone room with info about added issue if it was added again', async () => {
            const updateData = gitlabTracker.parser.getPostMilestoneUpdatesData(createdIssue);
            const deletedData = gitlabTracker.parser.getPostMilestoneUpdatesData(milestoneDeleted);
            await postMilestoneUpdates.run(updateData);
            await postMilestoneUpdates.run(deletedData);
            const result = await postMilestoneUpdates.run(updateData);

            const message = translate('issueAddedToMilestone', {
                viewUrl: gitlabTracker.getViewUrl(updateData.issueKey),
                summary: createdIssue.object_attributes.title,
                user: createdIssue.user.name,
            });
            const expectedData = [roomId, message, marked(message)];

            expect(result).to.be.eq(message);
            expect(chatSingle.sendHtmlMessage).have.to.be.calledWithExactly(...expectedData);
        });

        it('Should send message to milestone room with info about added issue if milestone updated', async () => {
            const updateData = gitlabTracker.parser.getPostMilestoneUpdatesData(milestoneUpdated);
            const result = await postMilestoneUpdates.run(updateData);

            const message = translate('issueAddedToMilestone', {
                viewUrl: gitlabTracker.getViewUrl(updateData.issueKey),
                summary: milestoneUpdated.object_attributes.title,
                user: milestoneUpdated.user.name,
            });
            const expectedData = [roomId, message, marked(message)];

            expect(result).to.be.eq(message);
            expect(chatSingle.sendHtmlMessage).have.to.be.calledWithExactly(...expectedData);
        });

        it('Should send message to milestone room with info about deleted issue', async () => {
            const updateData = gitlabTracker.parser.getPostMilestoneUpdatesData(milestoneDeleted);
            const result = await postMilestoneUpdates.run(updateData);

            const message = translate('issueDeletedFromMilestone', {
                viewUrl: gitlabTracker.getViewUrl(updateData.issueKey),
                summary: milestoneDeleted.object_attributes.title,
                user: milestoneDeleted.user.name,
            });
            const expectedData = [roomId, message, marked(message)];

            expect(result).to.be.eq(message);
            expect(chatSingle.sendHtmlMessage).have.to.be.calledWithExactly(...expectedData);
        });

        it('Should send message to milestone room with info about closed issue', async () => {
            const updateData = gitlabTracker.parser.getPostMilestoneUpdatesData(issueClosed);
            const result = await postMilestoneUpdates.run(updateData);

            const message = translate('issueClosedInMilestone', {
                viewUrl: gitlabTracker.getViewUrl(updateData.issueKey),
                summary: issueClosed.object_attributes.title,
                user: issueClosed.user.name,
            });
            const expectedData = [roomId, message, marked(message)];

            expect(result).to.be.eq(message);
            expect(chatSingle.sendHtmlMessage).have.to.be.calledWithExactly(...expectedData);
        });

        it('Should send message to milestone room with info about reopen issue', async () => {
            const updateData = gitlabTracker.parser.getPostMilestoneUpdatesData(issueReopen);
            const result = await postMilestoneUpdates.run(updateData);

            const message = translate('issueReopenInMilestone', {
                viewUrl: gitlabTracker.getViewUrl(updateData.issueKey),
                summary: issueReopen.object_attributes.title,
                user: issueReopen.user.name,
            });
            const expectedData = [roomId, message, marked(message)];

            expect(result).to.be.eq(message);
            expect(chatSingle.sendHtmlMessage).have.to.be.calledWithExactly(...expectedData);
        });
    });
});
