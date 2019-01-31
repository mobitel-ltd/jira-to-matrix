/* eslint-disable no-undefined */
const assert = require('assert');
const firstJSON = require('../fixtures/webhooks/comment/created.json');
const secondJSON = require('../fixtures/webhooks/issue/updated/commented.json');
const {getBotActions, getParserName, getFuncAndBody} = require('../../src/jira-hook-parser/bot-handler.js');
const translate = require('../../src/locales');

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
                        'roomMembers': [
                            'jira_test',
                        ],
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
                    'projectKey': undefined,
                    'webhookEvent': 'jira:issue_updated',

                },
            },
            {
                redisKey: 'inviteNewMembers_1511973439683',
                funcName: 'inviteNewMembers',
                data: {
                    'issue': {
                        'roomMembers': [
                            'jira_test',
                        ],
                        'key': 'BBCOM-956',
                    },
                },
            },
            {
                redisKey: 'postEpicUpdates_1511973439683',
                funcName: 'postEpicUpdates',
                data: {
                    data: {
                        'changelog': undefined,
                        'id': '26313',
                        'key': 'BBCOM-956',
                        'name': 'jira_test',
                        'status': null,
                        'summary': 'BBCOM-956',
                    },
                    epicKey: 'BBCOM-801',
                },
            },
        ];

        assert.deepEqual(funcAndBodyFirst, firstBodyArrExpected);
        assert.deepEqual(funcAndBodySecond, secondBodyArrExpected);
    });
});
