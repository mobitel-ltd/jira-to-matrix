import * as R from 'ramda';
import * as assert from 'assert';
import commentHook from '../../fixtures/webhooks/gitlab/commented.json';
import issueCreated from '../../fixtures/webhooks/gitlab/issue/created.json';
import { config } from '../../../src/config';
import { Config, CreateRoomData } from '../../../src/types';
import { HookParser } from '../../../src/hook-parser';
import { getTaskTracker } from '../../../src/task-trackers';
import { REDIS_ROOM_KEY } from '../../../src/redis-client';
import { translate } from '../../../src/locales';

describe('Gitlab actions', () => {
    const gitlabConfig: Config = R.set(R.lensPath(['taskTracker', 'type']), 'gitlab', config);

    const gitlabApi = getTaskTracker(gitlabConfig);

    const hookParser = new HookParser(gitlabApi, gitlabConfig, {} as any);

    it('should return postComment for note webhook', () => {
        const result = gitlabApi.parser.getBotActions(commentHook);
        const expected = ['postComment'];
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
                redisKey: 'postComment_' + new Date(commentHook.object_attributes.created_at).getTime(),
                funcName: 'postComment',
                data: {
                    issueId: commentHook.project.path_with_namespace + '-' + commentHook.issue.iid,
                    headerText: translate('comment_created', { name: commentHook.user.name }),
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

    it('should return create room for issue created hook', () => {
        const expected: { redisKey: typeof REDIS_ROOM_KEY; createRoomData: CreateRoomData }[] = [
            {
                redisKey: REDIS_ROOM_KEY,
                createRoomData: {
                    issue: {
                        key: issueCreated.project.path_with_namespace + '-' + issueCreated.object_attributes.iid,
                        descriptionFields: undefined,
                        projectKey: issueCreated.project.path_with_namespace,
                        summary: issueCreated.object_attributes.title,
                    },
                    projectKey: issueCreated.project.path_with_namespace,
                },
            },
        ];

        const res = hookParser.getFuncAndBody(issueCreated);

        assert.deepEqual(res, expected);
    });
});
