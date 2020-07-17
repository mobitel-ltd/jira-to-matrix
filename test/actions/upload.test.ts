import nock from 'nock';
import uploadHook from '../fixtures/webhooks/gitlab/upload.json';
import { getChatClass, defaultRoomId } from '../test-utils';
import { Upload } from '../../src/bot/actions/upload';
import { config } from '../../src/config';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { Gitlab } from '../../src/task-trackers/gitlab';
import projectsJson from '../fixtures/gitlab-api-requests/project-search.gitlab.json';
import gitlabIssueComments from '../fixtures/gitlab-api-requests/comments.json';
import { UploadData } from '../../src/types';

const { expect } = chai;
chai.use(sinonChai);

describe('Gitlab api', () => {
    let chatApi;
    let chatSingle;
    let upload: Upload;
    const gitlabTracker = new Gitlab({ ...config.taskTracker, features: config.features });

    const uploadData: UploadData = gitlabTracker.parser.getUploadData(uploadHook);

    beforeEach(() => {
        nock(gitlabTracker.getRestUrl())
            .get(`/projects`)
            .query({ search: uploadHook.project.path_with_namespace })
            .reply(200, projectsJson)
            .get(`/projects/${projectsJson[0].id}/issues/${uploadHook.issue.iid}/notes`)
            .reply(200, gitlabIssueComments);

        const chatClass = getChatClass({ alias: uploadData.issueKey });
        chatSingle = chatClass.chatApiSingle;
        chatApi = chatClass.chatApi;

        upload = new Upload(config, gitlabTracker, chatApi);
    });

    after(() => {
        nock.cleanAll();
    });

    it('Expect postComment works correct with comment-created hook and no body in comments collection', async () => {
        const result = await upload.run(uploadData);

        expect(result).to.be.true;
        expect(chatSingle.upload).to.be.calledWithExactly(defaultRoomId, uploadData.uploadUrl);
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(
            defaultRoomId,
            uploadData.uploadInfo,
            uploadData.uploadInfo,
        );
    });
});
