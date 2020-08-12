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
    IssueStateEnum,
    PostPipelineData,
} from '../../../src/types';
import { HookParser } from '../../../src/hook-parser';
import { getTaskTracker } from '../../../src/task-trackers';
import { REDIS_ROOM_KEY } from '../../../src/redis-client';
import { translate } from '../../../src/locales';
import uploadHook from '../../fixtures/webhooks/gitlab/upload.json';
import gitlabClosedIssue from '../../fixtures/webhooks/gitlab/issue/closed.json';
import gitlabReopenedIssue from '../../fixtures/webhooks/gitlab/issue/reopened.json';
import pipelineHook from '../../fixtures/webhooks/gitlab/pipe-success.json';
import uploadHookBin from '../../fixtures/webhooks/gitlab/upload-bin.json';
import { stub } from 'sinon';

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

    it('should return create room and post comment for note hook', () => {
        const expected = [
            {
                redisKey: REDIS_ROOM_KEY,
                createRoomData: {
                    issue: {
                        key: commentHook.project.path_with_namespace + '-' + commentHook.issue.iid,
                        descriptionFields: undefined,
                        projectKey: commentHook.project.path_with_namespace,
                        summary: commentHook.issue.title,
                    },
                    projectKey: commentHook.project.path_with_namespace,
                },
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
                IssueStateEnum.open +
                ';' +
                issueUpdated.project.path_with_namespace +
                '/issues/' +
                issueUpdated.object_attributes.iid +
                ';',

            changes: [{ field: 'title', newValue: issueUpdated.changes.title.current }],
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
            },
            projectKey: issueUpdated.project.path_with_namespace,
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
        const expected: { redisKey: typeof REDIS_ROOM_KEY; createRoomData: CreateRoomData }[] = [
            {
                redisKey: REDIS_ROOM_KEY,
                createRoomData: {
                    issue: {
                        key: issueCreated.project.path_with_namespace + '-' + issueCreated.object_attributes.iid,
                        descriptionFields: undefined,
                        hookLabels: undefined, // NEED CHANGE!
                        projectKey: issueCreated.project.path_with_namespace,
                        summary: issueCreated.object_attributes.title,
                    },
                    projectKey: issueCreated.project.path_with_namespace,
                },
            },
        ];
        //         (hookLabels || []).map(label => label.color);

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
            },
            projectKey: uploadHook.project.path_with_namespace,
        };
        const data: UploadData = {
            issueKey: uploadHook.project.path_with_namespace + '-' + uploadHook.issue.iid,
            uploadUrl: uploadHook.object_attributes.description.slice(8, -1),
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
            },
            projectKey: uploadHookBin.project.path_with_namespace,
        };
        const data: UploadData = {
            issueKey: uploadHookBin.project.path_with_namespace + '-' + uploadHookBin.issue.iid,
            uploadUrl: uploadHookBin.project.web_url + uploadHookBin.object_attributes.description.slice(19, -1),
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
                IssueStateEnum.close +
                ';' +
                gitlabClosedIssue.project.path_with_namespace +
                '/issues/' +
                gitlabClosedIssue.object_attributes.iid +
                ';',

            changes: [{ field: 'status', newValue: IssueStateEnum.close }],
        };
        const createRoomData: CreateRoomData = {
            issue: {
                key: gitlabClosedIssue.project.path_with_namespace + '-' + gitlabClosedIssue.object_attributes.iid,
                descriptionFields: undefined,
                projectKey: gitlabClosedIssue.project.path_with_namespace,
                summary: gitlabClosedIssue.object_attributes.title,
            },
            projectKey: gitlabClosedIssue.project.path_with_namespace,
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
        ];

        const res = hookParser.getFuncAndBody(gitlabClosedIssue);

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
                IssueStateEnum.open +
                ';' +
                gitlabReopenedIssue.project.path_with_namespace +
                '/issues/' +
                gitlabReopenedIssue.object_attributes.iid +
                ';',

            changes: [{ field: 'status', newValue: IssueStateEnum.open }],
        };
        const createRoomData: CreateRoomData = {
            issue: {
                key: gitlabReopenedIssue.project.path_with_namespace + '-' + gitlabReopenedIssue.object_attributes.iid,
                descriptionFields: undefined,
                projectKey: gitlabReopenedIssue.project.path_with_namespace,
                summary: gitlabReopenedIssue.object_attributes.title,
            },
            projectKey: gitlabReopenedIssue.project.path_with_namespace,
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
        ];

        const res = hookParser.getFuncAndBody(gitlabReopenedIssue);

        assert.deepEqual(res, expected);
    });

    it.skip('should post pipeline data for pipeline hook', () => {
        const postPipelineData: PostPipelineData = {
            author: `${pipelineHook.user.username} ${pipelineHook.user.name}`,
            // issue id is extracted pipelineHook.commit.message
            issueKeys: [pipelineHook.project.path_with_namespace + '-' + 2],
            pipelineData: {
                object_kind: HookTypes.Pipeline,
                object_attributes: {
                    created_at: pipelineHook.object_attributes.created_at,
                    duration: pipelineHook.object_attributes.duration,
                    ref: pipelineHook.object_attributes.ref,
                    sha: pipelineHook.object_attributes.sha,
                    status: pipelineHook.object_attributes.status,
                    tag: pipelineHook.object_attributes.tag,
                    username: pipelineHook.user.username,
                    url: pipelineHook.project.web_url + '/pipelines/' + pipelineHook.object_attributes.id,
                    stages: [
                        {
                            validate: {
                                'lint-dockerfile': 'success',
                                'node-gitignore-validate': 'success',
                                'dockerignore-validate': 'success',
                                'scan-sonarqube': 'success',
                                'node-docs-validate': 'success',
                            },
                        },
                        {
                            'build-release': {
                                'release-image-dind': 'success',
                            },
                        },
                        {
                            'build-debug': {
                                'debug-image-dind': 'success',
                            },
                        },
                        {
                            test: {
                                'node-coverage': 'success',
                                'node-unit': 'success',
                                'node-lint': 'success',
                                'security-todo': 'success',
                            },
                        },
                    ],
                },
            },
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

        const res = hookParser.getFuncAndBody(pipelineHook);

        assert.deepEqual(res, expected);
    });
});
