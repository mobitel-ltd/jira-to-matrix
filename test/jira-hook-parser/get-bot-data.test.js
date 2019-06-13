/* eslint-disable no-undefined */
const assert = require('assert');
const firstJSON = require('../fixtures/webhooks/comment/created.json');
const secondJSON = require('../fixtures/webhooks/issue/updated/commented.json');
const {getBotActions, getParserName, getFuncAndBody} = require('../../src/jira-hook-parser/bot-handler.js');
const translate = require('../../src/locales');
const issueMovedJSON = require('../fixtures/webhooks/issue/updated/move-issue.json');
const utils = require('../../src/lib/utils');

describe('get-bot-data', () => {
    const firstBodyArr = getBotActions(firstJSON);
    const secondBodyArr = getBotActions(secondJSON);

    it('test correct getBotActions', () => {
        const firstBodyArrExpected = ['postComment'];
        const secondBodyArrExpected = ['inviteNewMembers', 'postEpicUpdates'];

        assert.deepEqual(firstBodyArrExpected, firstBodyArr);
        assert.deepEqual(secondBodyArrExpected, secondBodyArr);
    });

    it('test correct getParserName', () => {
        const getParserNameFirst = firstBodyArr.map(getParserName);
        const getParserNameSecond = secondBodyArr.map(getParserName);

        const firstBodyArrExpected = ['getPostCommentData'];
        assert.deepEqual(getParserNameFirst, firstBodyArrExpected);

        const secondBodyArrExpected = ['getInviteNewMembersData', 'getPostEpicUpdatesData'];
        assert.deepEqual(getParserNameSecond, secondBodyArrExpected);
    });

    it('Expect correct issue_moved data', () => {
        const res = getFuncAndBody(issueMovedJSON);
        const expected = [
            {
                createRoomData: false,
                redisKey: 'newrooms',
            },
            {
                redisKey: 'postIssueUpdates_2019-2-27 13:30:21,620',
                funcName: 'postIssueUpdates',
                data: {
                    oldKey: 'TCP-2',
                    newKey: 'INDEV-130',
                    newNameData: {
                        key: 'INDEV-130',
                        summary: 'test Task 2',
                    },
                    changelog: utils.getChangelog(issueMovedJSON),
                    author: 'jira_test',
                },
            },
            {
                redisKey: 'inviteNewMembers_2019-2-27 13:30:21,620',
                funcName: 'inviteNewMembers',
                data: {
                    issue: {
                        key: 'INDEV-130',
                    },
                },
            },
        ];

        assert.deepEqual(res, expected);
    });

    it('test correct getFuncAndBody', () => {
        const funcAndBodyFirst = getFuncAndBody(firstJSON);
        const funcAndBodySecond = getFuncAndBody(secondJSON);

        const firstBodyArrExpected = [
            {
                redisKey: 'newrooms',
                createRoomData: undefined,
            },
            {
                redisKey: 'postComment_1512034084304',
                funcName: 'postComment',
                data: {
                    issueID: '26313',
                    headerText: translate('comment_created', {name: 'jira_test'}),
                    comment: {
                        body: '12345',
                        id: '31039',
                    },
                    author: 'jira_test',
                },
            },
        ];

        const secondBodyArrExpected = [
            {
                redisKey: 'newrooms',
                createRoomData: {
                    'issue': {
                        'descriptionFields': {
                            'assigneeEmail': 'jira_test@test-example.ru',
                            'assigneeName': 'jira_test',
                            'description': 'dafdasfadf',
                            'epicLink': 'BBCOM-801',
                            'estimateTime': translate('miss'),
                            'priority': 'Blocker',
                            'reporterEmail': 'jira_test@test-example.ru',
                            'reporterName': 'jira_test',
                            'typeName': 'Task',
                        },
                        'id': '26313',
                        'key': 'BBCOM-956',
                        'summary': 'BBCOM-956',
                    },
                    'projectKey': 'BBCOM',
                },
            },
            {
                redisKey: 'inviteNewMembers_1511973439683',
                funcName: 'inviteNewMembers',
                data: {
                    'issue': {
                        'key': 'BBCOM-956',
                    },
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
