const assert = require('assert');
const logger = require('../../src/modules/log.js')(module);
const firstJSON = require('../fixtures/comment-create-1.json');
const secondJSON = require('../fixtures/comment-create-2.json');
const parsers = require('../../src/queue/parse-body.js');
const bot = require('../../src/bot');
const {getBotFunc, getParserName, getFuncAndBody} = require('../../src/queue/bot-handler.js');

describe('get-bot-data', function() {
    const firstBodyArr = getBotFunc(firstJSON);
    const secondBodyArr = getBotFunc(secondJSON);

    it('test correct getBotFunc', () => {
        const firstBodyArrExpected = [ 'postComment' ];
        const secondBodyArrExpected = [ 'inviteNewMembers', 'postEpicUpdates' ];

        assert.deepEqual(firstBodyArrExpected, firstBodyArr);
        assert.deepEqual(secondBodyArrExpected, secondBodyArr);
    })

    it('test correct getParserName', () => {
        const getParserNameFirst = firstBodyArr.map(getParserName);
        const getParserNameSecond = secondBodyArr.map(getParserName);

        const firstBodyArrExpected = ['getPostCommentData'];
        assert.deepEqual(getParserNameFirst, firstBodyArrExpected);

        const secondBodyArrExpected = [ 'getInviteNewMembersData', 'getPostEpicUpdatesData' ];
        assert.deepEqual(getParserNameSecond, secondBodyArrExpected);
    });

    it('test correct getFuncAndBody', () => {
        const funcAndBodyFirst = getFuncAndBody(firstJSON);
        const funcAndBodySecond = getFuncAndBody(secondJSON);

        const firstBodyArrExpected = [
            {
                redisKey: 'rooms',
                createRoomData: null,
            },
            {
                redisKey: 'postComment_1512034084304',
                funcName: 'postComment',
                data: {
                    issueID: '26313',
                    headerText: 'jira_test добавил(а) комментарий',
                    comment: {
                        body: '12345',
                        id: '31039',
                    },
                    author: 'jira_test'
                }
            }
        ];

        const secondBodyArrExpected = [
            {
                redisKey: 'rooms',
                createRoomData: {
                    "issue": {
                        "collectParticipantsBody": [
                            "jira_test",
                            "jira_test",
                            "jira_test",
                        ],
                        "descriptionFields": {
                            "assigneeEmail": "jira_test@bingo-boom.ru",
                            "assigneeName": "jira_test",
                            "description": "dafdasfadf",
                            "epicLink": "BBCOM-801",
                            "estimateTime": "отсутствует",
                            "reporterEmail": "jira_test@bingo-boom.ru",
                            "reporterName": "jira_test",
                            "typeName": "Task",
                        },
                        "id": "26313",
                        "key": "BBCOM-956",
                        "summary": "BBCOM-956",
                        "url": "https://jira.bingo-boom.ru/jira/rest/api/2/issue/BBCOM-956/watchers",
                    },
                    "projectOpts": undefined,
                    "webhookEvent": "jira:issue_updated"

                },
            },
            {
                redisKey: 'inviteNewMembers_1511973439683',
                funcName: 'inviteNewMembers',
                data: {
                    "issue": {
                        "collectParticipantsBody": [
                            "jira_test",
                            "jira_test",
                            "jira_test",
                        ],
                        "key": "BBCOM-956",
                        "url": "https://jira.bingo-boom.ru/jira/rest/api/2/issue/BBCOM-956/watchers",
                    },
                }
            },
            {
                redisKey: 'postEpicUpdates_1511973439683',
                funcName: 'postEpicUpdates',
                data: {
                    data: {
                            "changelog": undefined,
                            "id": "26313",
                            "key": "BBCOM-956",
                            "name": "jira_test",
                            'status': null,
                            "summary": "BBCOM-956",
                        },
                    epicKey: "BBCOM-801",
                },
            }
        ];

        assert.deepEqual(funcAndBodyFirst, firstBodyArrExpected);
        assert.deepEqual(funcAndBodySecond, secondBodyArrExpected);
    });
});
