import * as assert from 'assert';
import firstJSON from '../../fixtures/webhooks/comment/created.json';
import secondJSON from '../../fixtures/webhooks/issue/updated/commented.json';
import { translate } from '../../../src/locales';
import issueMovedJSON from '../../fixtures/webhooks/issue/updated/move-issue.json';
import { config } from '../../../src/config';
import { getTaskTracker } from '../../../src/task-trackers';
import { HookParser } from '../../../src/hook-parser';
import { Jira } from '../../../src/task-trackers/jira';
import { REDIS_ROOM_KEY } from '../../../src/redis-client';
import { PostIssueUpdatesData } from '../../../src/types';

describe('get-bot-data for jira', () => {
    const jiraApi = getTaskTracker(config) as Jira;
    const firstBodyArr = jiraApi.parser.getBotActions(firstJSON);
    const secondBodyArr = jiraApi.parser.getBotActions(secondJSON);

    const hookParser = new HookParser(jiraApi, config, {} as any);

    it('test correct getBotActions', () => {
        const firstBodyArrExpected = ['postComment'];
        const secondBodyArrExpected = ['inviteNewMembers', 'postEpicUpdates'];

        assert.deepEqual(firstBodyArrExpected, firstBodyArr);
        assert.deepEqual(secondBodyArrExpected, secondBodyArr);
    });

    it('test correct getParserName', () => {
        const getParserNameFirst = firstBodyArr.map(el => hookParser.getParserName(el));
        const getParserNameSecond = secondBodyArr.map(el => hookParser.getParserName(el));

        const firstBodyArrExpected = ['getPostCommentData'];
        assert.deepEqual(getParserNameFirst, firstBodyArrExpected);

        const secondBodyArrExpected = ['getInviteNewMembersData', 'getPostEpicUpdatesData'];
        assert.deepEqual(getParserNameSecond, secondBodyArrExpected);
    });

    it('Expect correct issue_moved data', () => {
        const res = hookParser.getFuncAndBody(issueMovedJSON);
        const expected: (
            | { redisKey: string; createRoomData: false }
            | { redisKey: string; funcName: string; data: PostIssueUpdatesData }
        )[] = [
            {
                createRoomData: false,
                redisKey: 'newrooms',
            },
            {
                redisKey: 'postIssueUpdates_2019-2-27 13:30:21,620',
                funcName: 'postIssueUpdates',
                data: {
                    newStatusId: 10257,
                    oldKey: 'TCP-2',
                    newKey: 'INDEV-130',
                    isNewStatus: true,
                    newRoomName: 'INDEV-130' + ' ' + 'test Task 2',
                    changes: jiraApi.selectors.getIssueChanges(issueMovedJSON)!,
                    author: 'jira_test',
                    projectKey: issueMovedJSON.issue.fields.project.key,
                },
            },
        ];

        assert.deepEqual(res, expected);
    });

    it('test correct getFuncAndBody', () => {
        const funcAndBodyFirst = hookParser.getFuncAndBody(firstJSON);
        const funcAndBodySecond = hookParser.getFuncAndBody(secondJSON);

        const firstBodyArrExpected = [
            {
                redisKey: REDIS_ROOM_KEY,
                createRoomData: false,
            },
            {
                redisKey: 'postComment_1512034084304',
                funcName: 'postComment',
                data: {
                    issueId: '26313',
                    headerText: translate('comment_created', { name: firstJSON.comment.updateAuthor.displayName }),
                    comment: {
                        body: '12345',
                        id: '31039',
                    },
                    author: firstJSON.comment.updateAuthor.displayName,
                },
            },
        ];

        const secondBodyArrExpected = [
            {
                redisKey: REDIS_ROOM_KEY,
                createRoomData: {
                    issue: {
                        descriptionFields: {
                            assigneeName: 'jira_test',
                            description: 'dafdasfadf',
                            epicLink: 'BBCOM-801',
                            estimateTime: translate('miss'),
                            priority: 'Blocker',
                            reporterName: 'jira_test',
                            typeName: 'Task',
                        },
                        id: '26313',
                        key: 'BBCOM-956',
                        summary: 'BBCOM-956',
                        projectKey: 'BBCOM',
                    },
                    projectKey: 'BBCOM',
                },
            },
            {
                redisKey: 'inviteNewMembers_1511973439683',
                funcName: 'inviteNewMembers',
                data: {
                    key: 'BBCOM-956',
                    projectKey: 'BBCOM',
                    typeName: 'Task',
                },
            },
            {
                redisKey: 'postEpicUpdates_1511973439683',
                funcName: 'postEpicUpdates',
                data: {
                    data: {
                        id: '26313',
                        key: 'BBCOM-956',
                        name: 'jira_test',
                        summary: 'BBCOM-956',
                        status: undefined,
                    },
                    epicKey: 'BBCOM-801',
                },
            },
        ];

        assert.deepEqual(funcAndBodyFirst, firstBodyArrExpected);
        assert.deepEqual(funcAndBodySecond, secondBodyArrExpected);
    });

    // it('Expect project_create data have only project key, no issue data', () => {

    // });
});
