import * as R from 'ramda';
import * as assert from 'assert';
import commentHook from '../../fixtures/webhooks/gitlab/commented.json';
import issueCreated from '../../fixtures/webhooks/gitlab/issue/created.json';
import issueUpdated from '../../fixtures/webhooks/gitlab/issue/updated.json';
import { config } from '../../../src/config';
import {
    Config,
    CreateRoomData,
    PostIssueUpdatesData,
    InviteNewMembersData,
    UploadData,
    RoomViewStateEnum,
    PostPipelineData,
    PostMilestoneUpdatesData,
    MilestoneUpdateStatus,
} from '../../../src/types';
import { HookParser } from '../../../src/hook-parser';
import { getTaskTracker } from '../../../src/task-trackers';
import { REDIS_ROOM_KEY } from '../../../src/redis-client';
import { translate } from '../../../src/locales';
import uploadHook from '../../fixtures/webhooks/gitlab/upload.json';
import gitlabClosedIssue from '../../fixtures/webhooks/gitlab/issue/closed.json';
import gitlabReopenedIssue from '../../fixtures/webhooks/gitlab/issue/reopened.json';
import createdIssue from '../../fixtures/webhooks/gitlab/issue/created.json';
import pipelineHookSuccess from '../../fixtures/webhooks/gitlab/pipe-success.json';
import pipelineHookFail from '../../fixtures/webhooks/gitlab/pipe-failed.json';
import uploadHookBin from '../../fixtures/webhooks/gitlab/upload-bin.json';
import { stub } from 'sinon';
import milestoneUpdated from '../../fixtures/webhooks/gitlab/issue/milestone-updated.json';
import milestoneDeleted from '../../fixtures/webhooks/gitlab/issue/milestone-deleted.json';
import { GitlabParser } from '../../../src/task-trackers/gitlab/parser.gtilab';
import {
    extractKeysFromCommitMessage,
    extractProjectNameFromIssueKey,
} from '../../../src/task-trackers/gitlab/selectors';

describe('Gitlab actions', () => {
    const fakeTimestamp = 1596049533906;

    beforeEach(() => {
        stub(Date, 'now').returns(1596049533906);
    });

    afterEach(() => {
        (Date.now as any).restore();
    });

    const gitlabConfig: Config = R.set(R.lensPath(['taskTracker', 'type']), 'gitlab', config);

    const gitlabApi = getTaskTracker(gitlabConfig);

    const hookParser = new HookParser(gitlabApi, gitlabConfig, {} as any);

    it('should return postComment for note webhook', () => {
        const result = gitlabApi.parser.getBotActions(commentHook);
        const expected = ['postComment'];
        assert.deepEqual(result, expected);
    });

    it('should return inviteNewMebers for issue update webhook', () => {
        const result = gitlabApi.parser.getBotActions(issueUpdated);
        const expected = ['inviteNewMembers', 'postIssueUpdates'];
        assert.deepEqual(result, expected);
    });

    it('should return create room data with milestoneId if issue includes not null misestone', () => {
        const createRoomData: CreateRoomData = {
            issue: {
                key: createdIssue.project.path_with_namespace + '-' + createdIssue.object_attributes.iid,
                descriptionFields: undefined,
                projectKey: createdIssue.project.path_with_namespace,
                summary: createdIssue.object_attributes.title,
                hookLabels: createdIssue.object_attributes.labels,
            },
            projectKey: createdIssue.project.path_with_namespace,
            milestoneId: createdIssue.object_attributes.milestone_id,
        };
        const postMisestoneUpdatesData: PostMilestoneUpdatesData = {
            issueKey: createdIssue.project.path_with_namespace + '-' + createdIssue.object_attributes.iid,
            milestoneId: createdIssue.object_attributes.milestone_id,
            status: MilestoneUpdateStatus.Created,
            summary: createdIssue.object_attributes.title,
            user: createdIssue.user.name,
        };
        const expected = [
            {
                redisKey: REDIS_ROOM_KEY,
                createRoomData,
            },
            {
                redisKey: 'postMilestoneUpdates_' + fakeTimestamp,
                funcName: 'postMilestoneUpdates',
                data: postMisestoneUpdatesData,
            },
        ];

        const res = hookParser.getFuncAndBody(createdIssue);

        assert.deepEqual(res, expected);
    });

    it('should return create room and post comment for note hook', () => {
        const createRoomData: CreateRoomData = {
            issue: {
                key: commentHook.project.path_with_namespace + '-' + commentHook.issue.iid,
                descriptionFields: undefined,
                projectKey: commentHook.project.path_with_namespace,
                summary: commentHook.issue.title,
                hookLabels: commentHook.issue.labels,
            },
            projectKey: commentHook.project.path_with_namespace,
            milestoneId: undefined,
        };

        const expected = [
            {
                redisKey: REDIS_ROOM_KEY,
                createRoomData,
            },
            {
                redisKey: 'postComment_' + fakeTimestamp,
                funcName: 'postComment',
                data: {
                    issueId: commentHook.project.path_with_namespace + '-' + commentHook.issue.iid,
                    headerText: translate('comment_created', {
                        name: `${commentHook.user.username} ${commentHook.user.name}`,
                    }),
                    comment: {
                        body: commentHook.object_attributes.note,
                        id: commentHook.object_attributes.id,
                    },
                    author: commentHook.user.name,
                },
            },
        ];

        const res = hookParser.getFuncAndBody(commentHook);

        assert.deepEqual(res, expected);
    });

    it('should return create room and inviteNewMembers for issue update hook', () => {
        const postIssueUpdateData: PostIssueUpdatesData = {
            oldKey: issueUpdated.project.path_with_namespace + '-' + issueUpdated.object_attributes.iid,
            projectKey: issueUpdated.project.path_with_namespace,
            author: issueUpdated.user.name,
            isNewStatus: false,
            newRoomName:
                '#' +
                issueUpdated.object_attributes.iid +
                ';' +
                issueUpdated.object_attributes.title +
                ';' +
                RoomViewStateEnum.open +
                ';' +
                issueUpdated.project.path_with_namespace +
                '/issues/' +
                issueUpdated.object_attributes.iid +
                ';' +
                ';',

            changes: [{ field: 'title', newValue: issueUpdated.changes.title.current }],
            hookLabels: issueUpdated.labels,
        };
        const inviteNewMembersData: InviteNewMembersData = {
            key: issueUpdated.project.path_with_namespace + '-' + issueUpdated.object_attributes.iid,
            projectKey: issueUpdated.project.path_with_namespace,
            typeName: undefined,
        };

        const createRoomData: CreateRoomData = {
            issue: {
                key: issueUpdated.project.path_with_namespace + '-' + issueUpdated.object_attributes.iid,
                descriptionFields: undefined,
                projectKey: issueUpdated.project.path_with_namespace,
                summary: issueUpdated.object_attributes.title,
                hookLabels: issueUpdated.labels,
            },
            projectKey: issueUpdated.project.path_with_namespace,
            milestoneId: undefined,
        };
        const expected = [
            {
                redisKey: REDIS_ROOM_KEY,
                createRoomData,
            },
            {
                redisKey: 'inviteNewMembers_' + fakeTimestamp,
                funcName: 'inviteNewMembers',
                data: inviteNewMembersData,
            },
            {
                redisKey: 'postIssueUpdates_' + fakeTimestamp,
                funcName: 'postIssueUpdates',
                data: postIssueUpdateData,
            },
        ];

        const res = hookParser.getFuncAndBody(issueUpdated);

        assert.deepEqual(res, expected);
    });

    it('should return create room for issue created hook', () => {
        const createRoomData = {
            issue: {
                key: issueCreated.project.path_with_namespace + '-' + issueCreated.object_attributes.iid,
                descriptionFields: undefined,
                hookLabels: issueCreated.labels,
                projectKey: issueCreated.project.path_with_namespace,
                summary: issueCreated.object_attributes.title,
            },
            projectKey: issueCreated.project.path_with_namespace,
            milestoneId: issueCreated.object_attributes.milestone_id,
        };
        const postMisestoneUpdatesData: PostMilestoneUpdatesData = {
            issueKey: issueCreated.project.path_with_namespace + '-' + issueCreated.object_attributes.iid,
            milestoneId: issueCreated.object_attributes.milestone_id,
            status: MilestoneUpdateStatus.Created,
            summary: issueCreated.object_attributes.title,
            user: issueCreated.user.name,
        };
        const expected = [
            {
                redisKey: REDIS_ROOM_KEY,
                createRoomData,
            },
            {
                redisKey: 'postMilestoneUpdates_' + fakeTimestamp,
                funcName: 'postMilestoneUpdates',
                data: postMisestoneUpdatesData,
            },
        ];

        const res = hookParser.getFuncAndBody(issueCreated);

        assert.deepEqual(res, expected);
    });

    it('should return create room and upload for note hook with upload', () => {
        const createRoomData: CreateRoomData = {
            issue: {
                key: uploadHook.project.path_with_namespace + '-' + uploadHook.issue.iid,
                descriptionFields: undefined,
                projectKey: uploadHook.project.path_with_namespace,
                summary: uploadHook.issue.title,
                hookLabels: uploadHook.issue.labels,
            },
            projectKey: uploadHook.project.path_with_namespace,
            milestoneId: undefined,
        };
        const data: UploadData = {
            issueKey: uploadHook.project.path_with_namespace + '-' + uploadHook.issue.iid,
            uploadUrls: [uploadHook.object_attributes.description.slice(8, -1)],
            uploadInfo: translate('uploadInfo', { name: `${uploadHook.user.username} ${uploadHook.user.name}` }),
        };
        const expected = [
            {
                redisKey: REDIS_ROOM_KEY,
                createRoomData,
            },
            {
                redisKey: 'upload_' + fakeTimestamp,
                funcName: 'upload',
                data,
            },
        ];

        const res = hookParser.getFuncAndBody(uploadHook);

        assert.deepEqual(res, expected);
    });

    it('should return create room and upload for note hook with upload bin', () => {
        const createRoomData: CreateRoomData = {
            issue: {
                key: uploadHookBin.project.path_with_namespace + '-' + uploadHookBin.issue.iid,
                descriptionFields: undefined,
                projectKey: uploadHookBin.project.path_with_namespace,
                summary: uploadHookBin.issue.title,
                hookLabels: [],
            },
            projectKey: uploadHookBin.project.path_with_namespace,
            milestoneId: undefined,
        };
        const data: UploadData = {
            issueKey: uploadHookBin.project.path_with_namespace + '-' + uploadHookBin.issue.iid,
            uploadUrls: [uploadHookBin.project.web_url + uploadHookBin.object_attributes.description.slice(19, -1)],
            uploadInfo: translate('uploadInfo', {
                name: `${uploadHookBin.user.username} ${uploadHookBin.user.name}`,
            }),
        };

        const expected = [
            {
                redisKey: REDIS_ROOM_KEY,
                createRoomData,
            },
            {
                redisKey: 'upload_' + fakeTimestamp,
                funcName: 'upload',
                data,
            },
        ];

        const res = hookParser.getFuncAndBody(uploadHookBin);

        assert.deepEqual(res, expected);
    });

    it('should return create room, postIssueUpdate for issue closed hook', () => {
        const postIssueUpdateData: PostIssueUpdatesData = {
            oldKey: gitlabClosedIssue.project.path_with_namespace + '-' + gitlabClosedIssue.object_attributes.iid,
            projectKey: gitlabClosedIssue.project.path_with_namespace,
            author: gitlabClosedIssue.user.name,
            isNewStatus: true,
            newRoomName:
                '#' +
                gitlabClosedIssue.object_attributes.iid +
                ';' +
                gitlabClosedIssue.object_attributes.title +
                ';' +
                RoomViewStateEnum.close +
                ';' +
                gitlabClosedIssue.project.path_with_namespace +
                '/issues/' +
                gitlabClosedIssue.object_attributes.iid +
                ';' +
                ';',
            hookLabels: [],
            changes: [{ field: 'status', newValue: RoomViewStateEnum.close }],
        };
        const createRoomData: CreateRoomData = {
            issue: {
                key: gitlabClosedIssue.project.path_with_namespace + '-' + gitlabClosedIssue.object_attributes.iid,
                descriptionFields: undefined,
                projectKey: gitlabClosedIssue.project.path_with_namespace,
                summary: gitlabClosedIssue.object_attributes.title,
                hookLabels: [],
            },
            projectKey: gitlabClosedIssue.project.path_with_namespace,
            milestoneId: gitlabClosedIssue.object_attributes.milestone_id,
        };
        const postMisestoneUpdatesData: PostMilestoneUpdatesData = {
            issueKey: gitlabClosedIssue.project.path_with_namespace + '-' + gitlabClosedIssue.object_attributes.iid,
            milestoneId: gitlabClosedIssue.object_attributes.milestone_id,
            status: MilestoneUpdateStatus.Closed,
            summary: gitlabClosedIssue.object_attributes.title,
            user: gitlabClosedIssue.user.name,
        };
        const expected = [
            {
                redisKey: REDIS_ROOM_KEY,
                createRoomData,
            },
            {
                redisKey: 'postIssueUpdates_' + fakeTimestamp,
                funcName: 'postIssueUpdates',
                data: postIssueUpdateData,
            },
            {
                redisKey: 'postMilestoneUpdates_' + fakeTimestamp,
                funcName: 'postMilestoneUpdates',
                data: postMisestoneUpdatesData,
            },
        ];

        const res = hookParser.getFuncAndBody(gitlabClosedIssue);

        assert.deepEqual(res, expected);
    });

    it('should return create room, postIssueUpdate and postMilestoneUpdates for issue updated hook with milestone', () => {
        const postIssueUpdateData: PostIssueUpdatesData = {
            oldKey: milestoneUpdated.project.path_with_namespace + '-' + milestoneUpdated.object_attributes.iid,
            projectKey: milestoneUpdated.project.path_with_namespace,
            author: milestoneUpdated.user.name,
            isNewStatus: false,
            newRoomName:
                '#' +
                milestoneUpdated.object_attributes.iid +
                ';' +
                milestoneUpdated.object_attributes.title +
                ';' +
                RoomViewStateEnum.open +
                ';' +
                milestoneUpdated.project.path_with_namespace +
                '/issues/' +
                milestoneUpdated.object_attributes.iid +
                ';' +
                milestoneUpdated.object_attributes.milestone_id +
                ';',
            hookLabels: [],
            changes: [{ field: 'milestone_id', newValue: milestoneUpdated.changes.milestone_id.current as any }],
        };
        const createRoomData: CreateRoomData = {
            issue: {
                key: milestoneUpdated.project.path_with_namespace + '-' + milestoneUpdated.object_attributes.iid,
                descriptionFields: undefined,
                projectKey: milestoneUpdated.project.path_with_namespace,
                summary: milestoneUpdated.object_attributes.title,
                hookLabels: [],
            },
            projectKey: milestoneUpdated.project.path_with_namespace,
            milestoneId: milestoneUpdated.object_attributes.milestone_id,
        };
        const postMisestoneUpdatesData: PostMilestoneUpdatesData = {
            issueKey: milestoneUpdated.project.path_with_namespace + '-' + milestoneUpdated.object_attributes.iid,
            milestoneId: milestoneUpdated.object_attributes.milestone_id,
            status: MilestoneUpdateStatus.Created,
            summary: milestoneUpdated.object_attributes.title,
            user: milestoneUpdated.user.name,
        };
        const inviteNewMembersData: InviteNewMembersData = {
            key: milestoneUpdated.project.path_with_namespace + '-' + milestoneUpdated.object_attributes.iid,
            projectKey: gitlabReopenedIssue.project.path_with_namespace,
            typeName: undefined,
        };

        const expected = [
            {
                redisKey: REDIS_ROOM_KEY,
                createRoomData,
            },
            {
                redisKey: 'inviteNewMembers_' + fakeTimestamp,
                funcName: 'inviteNewMembers',
                data: inviteNewMembersData,
            },
            {
                redisKey: 'postIssueUpdates_' + fakeTimestamp,
                funcName: 'postIssueUpdates',
                data: postIssueUpdateData,
            },
            {
                redisKey: 'postMilestoneUpdates_' + fakeTimestamp,
                funcName: 'postMilestoneUpdates',
                data: postMisestoneUpdatesData,
            },
        ];

        const res = hookParser.getFuncAndBody(milestoneUpdated);

        assert.deepEqual(res, expected);
    });

    it('should return create room, postIssueUpdate and postMilestoneUpdates for issue deleted milestone hook', () => {
        const postIssueUpdateData: PostIssueUpdatesData = {
            oldKey: milestoneDeleted.project.path_with_namespace + '-' + milestoneDeleted.object_attributes.iid,
            projectKey: milestoneDeleted.project.path_with_namespace,
            author: milestoneDeleted.user.name,
            isNewStatus: false,
            newRoomName:
                '#' +
                milestoneDeleted.object_attributes.iid +
                ';' +
                milestoneDeleted.object_attributes.title +
                ';' +
                RoomViewStateEnum.open +
                ';' +
                milestoneDeleted.project.path_with_namespace +
                '/issues/' +
                milestoneDeleted.object_attributes.iid +
                ';' +
                ';',
            hookLabels: [],
            changes: [{ field: 'milestone_id', newValue: milestoneDeleted.changes.milestone_id.current as any }],
        };
        const createRoomData: CreateRoomData = {
            issue: {
                key: milestoneDeleted.project.path_with_namespace + '-' + milestoneDeleted.object_attributes.iid,
                descriptionFields: undefined,
                projectKey: milestoneDeleted.project.path_with_namespace,
                summary: milestoneDeleted.object_attributes.title,
                hookLabels: [],
            },
            projectKey: milestoneDeleted.project.path_with_namespace,
            milestoneId: milestoneDeleted.changes.milestone_id.previous,
        };
        const postMisestoneUpdatesData: PostMilestoneUpdatesData = {
            issueKey: milestoneDeleted.project.path_with_namespace + '-' + milestoneDeleted.object_attributes.iid,
            milestoneId: milestoneDeleted.changes.milestone_id.previous,
            status: MilestoneUpdateStatus.Deleted,
            summary: milestoneDeleted.object_attributes.title,
            user: milestoneDeleted.user.name,
        };
        const inviteNewMembersData: InviteNewMembersData = {
            key: milestoneDeleted.project.path_with_namespace + '-' + milestoneDeleted.object_attributes.iid,
            projectKey: gitlabReopenedIssue.project.path_with_namespace,
            typeName: undefined,
        };

        const expected = [
            {
                redisKey: REDIS_ROOM_KEY,
                createRoomData,
            },
            {
                redisKey: 'inviteNewMembers_' + fakeTimestamp,
                funcName: 'inviteNewMembers',
                data: inviteNewMembersData,
            },
            {
                redisKey: 'postIssueUpdates_' + fakeTimestamp,
                funcName: 'postIssueUpdates',
                data: postIssueUpdateData,
            },
            {
                redisKey: 'postMilestoneUpdates_' + fakeTimestamp,
                funcName: 'postMilestoneUpdates',
                data: postMisestoneUpdatesData,
            },
        ];

        const res = hookParser.getFuncAndBody(milestoneDeleted);

        assert.deepEqual(res, expected);
    });

    it('should return create room, inviteNewMembers, postIssueUpdate for issue reopen hook', () => {
        const postIssueUpdateData: PostIssueUpdatesData = {
            oldKey: gitlabReopenedIssue.project.path_with_namespace + '-' + gitlabReopenedIssue.object_attributes.iid,
            projectKey: gitlabReopenedIssue.project.path_with_namespace,
            author: gitlabReopenedIssue.user.name,
            isNewStatus: true,
            newRoomName:
                '#' +
                gitlabReopenedIssue.object_attributes.iid +
                ';' +
                gitlabReopenedIssue.object_attributes.title +
                ';' +
                RoomViewStateEnum.open +
                ';' +
                gitlabReopenedIssue.project.path_with_namespace +
                '/issues/' +
                gitlabReopenedIssue.object_attributes.iid +
                ';' +
                ';',
            hookLabels: gitlabReopenedIssue.labels,
            changes: [{ field: 'status', newValue: RoomViewStateEnum.open }],
        };
        const postMisestoneUpdatesData: PostMilestoneUpdatesData = {
            issueKey: gitlabReopenedIssue.project.path_with_namespace + '-' + gitlabReopenedIssue.object_attributes.iid,
            milestoneId: gitlabReopenedIssue.object_attributes.milestone_id,
            status: MilestoneUpdateStatus.Reopen,
            summary: gitlabReopenedIssue.object_attributes.title,
            user: gitlabReopenedIssue.user.name,
        };

        const createRoomData: CreateRoomData = {
            issue: {
                key: gitlabReopenedIssue.project.path_with_namespace + '-' + gitlabReopenedIssue.object_attributes.iid,
                descriptionFields: undefined,
                projectKey: gitlabReopenedIssue.project.path_with_namespace,
                hookLabels: gitlabReopenedIssue.labels,
                summary: gitlabReopenedIssue.object_attributes.title,
            },
            projectKey: gitlabReopenedIssue.project.path_with_namespace,
            milestoneId: gitlabReopenedIssue.object_attributes.milestone_id,
        };
        const inviteNewMembersData: InviteNewMembersData = {
            key: gitlabReopenedIssue.project.path_with_namespace + '-' + gitlabReopenedIssue.object_attributes.iid,
            projectKey: gitlabReopenedIssue.project.path_with_namespace,
            typeName: undefined,
        };
        const expected = [
            {
                redisKey: REDIS_ROOM_KEY,
                createRoomData,
            },
            {
                redisKey: 'inviteNewMembers_' + fakeTimestamp,
                funcName: 'inviteNewMembers',
                data: inviteNewMembersData,
            },
            {
                redisKey: 'postIssueUpdates_' + fakeTimestamp,
                funcName: 'postIssueUpdates',
                data: postIssueUpdateData,
            },
            {
                redisKey: 'postMilestoneUpdates_' + fakeTimestamp,
                funcName: 'postMilestoneUpdates',
                data: postMisestoneUpdatesData,
            },
        ];

        const res = hookParser.getFuncAndBody(gitlabReopenedIssue);

        assert.deepEqual(res, expected);
    });

    it('should post pipeline data for success pipeline hook', () => {
        const postPipelineData: PostPipelineData = {
            author: `${pipelineHookSuccess.user.username} ${pipelineHookSuccess.user.name}`,

            // issue id is extracted pipelineHook.commit.message
            //issueKeys: [pipelineHookSuccess.project.path_with_namespace + '-' + 2],
            pipelineData: extractKeysFromCommitMessage(
                pipelineHookSuccess.commit.message,
                pipelineHookSuccess.project.path_with_namespace,
            ).map(key => ({
                header: GitlabParser.getHeader(
                    extractProjectNameFromIssueKey(key),
                    pipelineHookSuccess.object_attributes.ref,
                    pipelineHookSuccess.object_attributes.status,
                ),
                key,
                pipeInfo: {
                    url: pipelineHookSuccess.project.web_url + '/pipelines/' + pipelineHookSuccess.object_attributes.id,
                    username: pipelineHookSuccess.user.username,
                    sha: pipelineHookSuccess.object_attributes.sha,
                },
            })),
        };

        const expected = [
            {
                redisKey: REDIS_ROOM_KEY,
                createRoomData: false,
            },
            {
                redisKey: 'postPipeline_' + fakeTimestamp,
                funcName: 'postPipeline',
                data: postPipelineData,
            },
        ];

        const res = hookParser.getFuncAndBody(pipelineHookSuccess);

        assert.deepEqual(res, expected);
    });

    it('should post pipeline data for failed pipeline hook', () => {
        const stages = [
            {
                'build-release': [
                    {
                        'release-image-dind': 'failed',
                    },
                ],
            },
        ];

        // const filteredOutput = stages.map(items => Lo.filter(items, el =>'failed'));
        // console.log(filteredOutput);

        const failOutput = {
            sha: pipelineHookFail.object_attributes.sha,
            username: pipelineHookFail.user.username,
            url: pipelineHookFail.project.web_url + '/pipelines/' + pipelineHookFail.object_attributes.id,
            stages: stages,
        };

        const postPipelineData: PostPipelineData = {
            author: `${pipelineHookSuccess.user.username} ${pipelineHookSuccess.user.name}`,

            // issue id is extracted pipelineHook.commit.message
            //issueKeys: [pipelineHookSuccess.project.path_with_namespace + '-' + 2],
            pipelineData: extractKeysFromCommitMessage(
                pipelineHookFail.commit.message,
                pipelineHookFail.project.path_with_namespace,
            ).map(key => ({
                header: GitlabParser.getHeader(
                    extractProjectNameFromIssueKey(key),
                    pipelineHookFail.object_attributes.ref,
                    pipelineHookFail.object_attributes.status,
                ),
                key,
                pipeInfo: failOutput,
            })) as any,
        };

        const expected = [
            {
                redisKey: REDIS_ROOM_KEY,
                createRoomData: false,
            },
            {
                redisKey: 'postPipeline_' + fakeTimestamp,
                funcName: 'postPipeline',
                data: postPipelineData,
            },
        ];

        const res = hookParser.getFuncAndBody(pipelineHookFail);

        assert.deepEqual(res, expected);
    });
});
