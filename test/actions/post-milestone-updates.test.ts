import marked from 'marked';
import querystring from 'querystring';
import { config } from '../../src/config';
import nock from 'nock';
import * as chai from 'chai';
import { translate } from '../../src/locales';
import sinonChai from 'sinon-chai';
import { getChatClass, cleanRedis } from '../test-utils';
import { PostMilestoneUpdatesData } from '../../src/types';
import { Gitlab } from '../../src/task-trackers/gitlab';
import createdIssue from '../fixtures/webhooks/gitlab/issue/created.json';
import gitlabIssueJson from '../fixtures/gitlab-api-requests/issue.json';
import { PostMilestoneUpdates } from '../../src/bot/actions/post-milestone-updates';
import gitlabProjectJson from '../fixtures/gitlab-api-requests/project-search.gitlab.json';

const { expect } = chai;

chai.use(sinonChai);

describe('PostMilestoneUpdates', () => {
    let gitlabTracker: Gitlab;
    let chatApi;
    let chatSingle;
    let postMilestoneUpdates: PostMilestoneUpdates;
    let updateData: PostMilestoneUpdatesData;
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
        let expectedData;
        let message;

        beforeEach(() => {
            nock(gitlabTracker.getRestUrl())
                .get(`/projects/${querystring.escape(createdIssue.project.path_with_namespace)}`)
                .times(3)
                .reply(200, gitlabProjectJson)
                .get(`/projects/${gitlabProjectJson.id}/issues/${createdIssue.object_attributes.iid}`)
                .times(3)
                .reply(200, gitlabIssueJson);

            message = translate('issueAddedToMilestone', {
                viewUrl: gitlabTracker.getViewUrl(gitlabTracker.selectors.getIssueKey(gitlabIssueJson)!),
                summary: createdIssue.object_attributes.title,
                user: createdIssue.user.name,
            });
            expectedData = [roomId, marked(message), marked(message)];
            updateData = gitlabTracker.parser.getPostMilestoneUpdatesData(createdIssue);
            const chatClass = getChatClass({ roomId });
            chatApi = chatClass.chatApi;
            chatSingle = chatClass.chatApiSingle;
            chatSingle.getRoomId.resolves(roomId);

            postMilestoneUpdates = new PostMilestoneUpdates(config, gitlabTracker, chatApi);
        });

        it('Should send message to milestone room with info about added issue', async () => {
            const result = await postMilestoneUpdates.run(updateData);

            expect(result).to.be.eq(message);
            expect(chatSingle.sendHtmlMessage).have.to.be.calledWithExactly(...expectedData);
        });
    });
});
