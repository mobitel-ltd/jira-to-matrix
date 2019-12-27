const proxyquire = require('proxyquire');
const assert = require('assert');
const firstJSON = require('../fixtures/webhooks/comment/created.json');
const secondJSON = require('../fixtures/webhooks/issue/updated/commented.json');
const issueStatusChangedJSON = require('../fixtures/webhooks/issue/updated/status-changed.json');
const issueWithParentIssueCreatedJSON = require('../fixtures/webhooks/issue/parent/created.json');
const issueWithParentIssueUpdatedJSON = require('../fixtures/webhooks/issue/parent/updated.json');
const { getBotActions, getParserName, getFuncAndBody } = require('../../src/jira-hook-parser/bot-handler.js');
const translate = require('../../src/locales');
const issueMovedJSON = require('../fixtures/webhooks/issue/updated/move-issue.json');
const utils = require('../../src/lib/utils');
const config = require('../../src/config');

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
                    newStatusId: 10257,
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
                    headerText: translate('comment_created', { name: 'jira_test' }),
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
                    issue: {
                        descriptionFields: {
                            assigneeEmail: 'jira_test@test-example.ru',
                            assigneeName: 'jira_test',
                            description: 'dafdasfadf',
                            epicLink: 'BBCOM-801',
                            estimateTime: translate('miss'),
                            priority: 'Blocker',
                            reporterEmail: 'jira_test@test-example.ru',
                            reporterName: 'jira_test',
                            typeName: 'Task',
                        },
                        id: '26313',
                        key: 'BBCOM-956',
                        summary: 'BBCOM-956',
                    },
                    projectKey: 'BBCOM',
                },
            },
            {
                redisKey: 'inviteNewMembers_1511973439683',
                funcName: 'inviteNewMembers',
                data: {
                    issue: {
                        key: 'BBCOM-956',
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

describe('No issue rooms mode', () => {
    const noIssuHandlers = proxyquire('../../src/jira-hook-parser/bot-handler.js', {
        '../config': { ...config, features: { noIssueRooms: true } },
    });

    it('test correct getBotActions', () => {
        const res = noIssuHandlers.getBotActions(issueStatusChangedJSON);
        // const expected = ['postParentUpdates', 'inviteNewMembers'];
        const expected = ['postParentUpdates'];

        assert.deepEqual(expected, res);
    });

    it('Expect parent project room create and parent project updates return, but issue actions is not used', () => {
        const res = noIssuHandlers.getFuncAndBody(issueStatusChangedJSON);

        const expected = [
            {
                redisKey: 'newrooms',
                createRoomData: {
                    issue: {
                        key: undefined,
                    },
                    projectKey: issueStatusChangedJSON.issue.fields.project.key,
                },
            },
            // {
            //     redisKey: `inviteNewMembers_${issueStatusChangedJSON.timestamp}`,
            //     funcName: 'inviteNewMembers',
            //     data: {
            //         parentKey: issueStatusChangedJSON.issue.fields.project.key,
            //     },
            // },
            {
                redisKey: `postParentUpdates_${issueStatusChangedJSON.timestamp}`,
                funcName: 'postParentUpdates',
                data: {
                    parentKey: issueStatusChangedJSON.issue.fields.project.key,
                    childData: {
                        key: issueStatusChangedJSON.issue.key,
                        status: issueStatusChangedJSON.changelog.items[0].toString,
                        id: issueStatusChangedJSON.issue.id,
                        summary: issueStatusChangedJSON.issue.fields.summary,
                        name: issueStatusChangedJSON.user.displayName,
                    },
                },
            },
        ];

        assert.deepEqual(res, expected);
    });

    it('Expect project issue room create and parent project updates return, but issue actions is not used if issue_created hook we get that has epic (no parent info in hook)', () => {
        const res = noIssuHandlers.getFuncAndBody(issueWithParentIssueCreatedJSON);

        const expected = [
            {
                redisKey: 'newrooms',
                createRoomData: {
                    issue: {
                        key: undefined,
                    },
                    projectKey: issueWithParentIssueCreatedJSON.issue.fields.project.key,
                },
            },
            // {
            //     redisKey: `inviteNewMembers_${issueStatusChangedJSON.timestamp}`,
            //     funcName: 'inviteNewMembers',
            //     data: {
            //         parentKey: issueStatusChangedJSON.issue.fields.project.key,
            //     },
            // },
            {
                redisKey: `postParentUpdates_${issueWithParentIssueCreatedJSON.timestamp}`,
                funcName: 'postParentUpdates',
                data: {
                    parentKey: issueWithParentIssueCreatedJSON.issue.fields.project.key,
                    childData: {
                        key: issueWithParentIssueCreatedJSON.issue.key,
                        status: issueWithParentIssueCreatedJSON.changelog.items[2].toString,
                        id: issueWithParentIssueCreatedJSON.issue.id,
                        summary: issueWithParentIssueCreatedJSON.issue.fields.summary,
                        name: issueWithParentIssueCreatedJSON.user.displayName,
                    },
                },
            },
        ];

        assert.deepEqual(res, expected);
    });

    it('Expect project and parent issue room creates and parent issue updates return, but issue actions is not used if issue_updated hook that has epic (no parent info in hook) we get', () => {
        const res = noIssuHandlers.getFuncAndBody(issueWithParentIssueUpdatedJSON);

        const expected = [
            {
                redisKey: 'newrooms',
                createRoomData: {
                    issue: {
                        key: issueWithParentIssueUpdatedJSON.issue.fields.parent.key,
                    },
                    projectKey: issueWithParentIssueUpdatedJSON.issue.fields.project.key,
                },
            },
            // {
            //     redisKey: `inviteNewMembers_${issueStatusChangedJSON.timestamp}`,
            //     funcName: 'inviteNewMembers',
            //     data: {
            //         parentKey: issueStatusChangedJSON.issue.fields.project.key,
            //     },
            // },
            {
                redisKey: `postParentUpdates_${issueWithParentIssueUpdatedJSON.timestamp}`,
                funcName: 'postParentUpdates',
                data: {
                    parentKey: issueWithParentIssueUpdatedJSON.issue.fields.parent.key,
                    childData: {
                        key: issueWithParentIssueUpdatedJSON.issue.key,
                        status: issueWithParentIssueUpdatedJSON.changelog.items[0].toString,
                        id: issueWithParentIssueUpdatedJSON.issue.id,
                        name: issueWithParentIssueUpdatedJSON.user.displayName,
                        summary: issueWithParentIssueUpdatedJSON.issue.fields.summary,
                    },
                },
            },
        ];

        assert.deepEqual(res, expected);
    });
});
