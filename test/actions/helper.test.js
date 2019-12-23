const { getRestUrl } = require('../../src/lib/utils.js');
const { pipe, set, clone } = require('lodash/fp');
const projectCreatedJSON = require('../fixtures/webhooks/project/created.json');
const issueCreatedJSON = require('../fixtures/webhooks/issue/created.json');
const { getCreateRoomData } = require('../../src/jira-hook-parser/parse-body.js');
const renderedIssueJSON = require('../fixtures/jira-api-requests/issue-rendered.json');
const statusJSON = require('../fixtures/jira-api-requests/status.json');
const htmlToText = require('html-to-text').fromString;
const faker = require('faker');
const marked = require('marked');
const newLinksbody = require('../fixtures/webhooks/issuelink/created.json');
const linksDeletedBody = require('../fixtures/webhooks/issuelink/deleted.json');
const {
    jira: { url: jiraUrl },
    usersToIgnore,
    testMode,
} = require('../../src/config');

const assert = require('assert');

// const testNewUserAssignBody = require('../fixtures/webhooks/issue/updated/issue-assigned.json');
const newGenNotIgnoreProject = require('../fixtures/jira-api-requests/project-gens/new-gen/correct.json');
const commentCreatedHook = require('../fixtures/webhooks/comment/created.json');
const notIgnoredIssueHook = require('../fixtures/webhooks/issue/updated/commented-changed.json');
const ignoredIssueHook = require('../fixtures/webhooks/issue/updated/generic.json');
const notIgnoreCreatorIssueBody = require('../fixtures/jira-api-requests/issue.json');
const rankHook = require('../fixtures/webhooks/issue/updated/rank-changed.json');
const utils = require('../../src/lib/utils');
const messages = require('../../src/lib/messages');
const nock = require('nock');

const chai = require('chai');
const { expect } = chai;

const ignnoreUsers = [...usersToIgnore, ...testMode.users];

const {
    getPostStatusData,
    getManuallyIgnore,
    getIgnoreProject,
    getDescription,
    getNewAvatarUrl,
} = require('../../src/bot/actions/helper.js');

const testUserId = faker.random.arrayElement(testMode.users);

const ignoreIssueKey = 'LALALLALA-1111';

const ignoredCreatorHook = pipe(
    clone,
    set('issue.key', ignoreIssueKey),
)(notIgnoredIssueHook);

const ignoredBody = pipe(
    clone,
    set('fields.creator.key', testUserId),
    set('fields.creator.name', testUserId),
)(notIgnoreCreatorIssueBody);

describe('Helper tests', () => {
    afterEach(() => {
        nock.cleanAll();
    });

    it('getPostStatusData with null', () => {
        const data = {
            key: 'BBCOM-956',
            summary: 'BBCOM-956',
            id: '26313',
            changelog: null,
            name: testUserId,
        };

        const { body, htmlBody } = getPostStatusData(data);
        assert.equal(body, null);
        assert.equal(htmlBody, null);
    });

    describe('Test getManuallyIgnore', () => {
        beforeEach(() => {
            nock(getRestUrl())
                .get(`/issue/${notIgnoredIssueHook.issue.key}`)
                .reply(200, notIgnoreCreatorIssueBody)
                .get(`/issue/${ignoredCreatorHook.issue.key}`)
                .reply(200, ignoredBody);
        });

        describe('Test mode TRUE', () => {
            const testStatus = true;

            it('Issue creator is in the ignore-list, hook must NOT BE hundled (ignore-status=TRUE)', async () => {
                const ignoreStatus = await getManuallyIgnore(notIgnoredIssueHook, ignnoreUsers, testStatus);

                expect(ignoreStatus).to.be.true;
            });

            it('Issue creator is NOT in the ignore-list, hook must BE hundled (ignore-status=FALSE)', async () => {
                const ignoreStatus = await getManuallyIgnore(ignoredCreatorHook, ignnoreUsers, testStatus);

                expect(ignoreStatus).to.be.false;
            });
        });

        describe('Test mode FALSE', () => {
            const testStatus = false;

            it('Issue creator in the ignore-list, hook must NOT BE hundled (ignore-status=TRUE)', async () => {
                const ignoreStatus = await getManuallyIgnore(ignoredCreatorHook, ignnoreUsers, testStatus);

                expect(ignoreStatus).to.be.true;
            });

            it('Issue creator is NOT in the ignore-list, hook must BE hundled (ignore-status=FALSE)', async () => {
                const ignoreStatus = await getManuallyIgnore(notIgnoredIssueHook, ignnoreUsers, testStatus);

                expect(ignoreStatus).to.be.false;
            });
        });
    });

    describe('geDescription test', () => {
        const createRoomData = getCreateRoomData(issueCreatedJSON);

        const epicKey = createRoomData.issue.descriptionFields.epicLink;

        const { descriptionFields } = createRoomData.issue;
        const description = marked(renderedIssueJSON.renderedFields.description);
        const post = `
            Assignee:
                <br>${utils.INDENT}${descriptionFields.assigneeName}
                <br>${utils.INDENT}${descriptionFields.assigneeEmail}<br>
            <br>Reporter:
                <br>${utils.INDENT}${descriptionFields.reporterName}
                <br>${utils.INDENT}${descriptionFields.reporterEmail}<br>
            <br>Type:
                <br>${utils.INDENT}${descriptionFields.typeName}<br>
            <br>Estimate time:
                <br>${utils.INDENT}${descriptionFields.estimateTime}<br>
            <br>Description:
                <br>${utils.INDENT}${description}<br>
            <br>Priority:
                <br>${utils.INDENT}${descriptionFields.priority}<br>`;
        const epicInfo = `            <br>Epic link:
                <br>${utils.INDENT}${epicKey}
                <br>${utils.INDENT}${utils.getViewUrl(epicKey)}<br>`;
        const expectedHTMLBody = [post, epicInfo].join('\n');
        const expectedBody = htmlToText(expectedHTMLBody);

        before(() => {
            nock(utils.getRestUrl())
                .get(`/issue/${issueCreatedJSON.issue.key}`)
                .query(utils.expandParams)
                .reply(200, renderedIssueJSON);
        });

        it('Description with epic should be created', async () => {
            const result = await getDescription(createRoomData.issue);
            expect(result).deep.eq({ body: expectedBody, htmlBody: expectedHTMLBody });
        });

        it('Description with error', async () => {
            let res;
            const expectedError = utils.getDefaultErrorLog('getDescription');
            try {
                res = await getDescription(createRoomData.issue);
            } catch (error) {
                res = error;
            }

            expect(res).to.include(expectedError);
        });
    });

    describe('Test getIgnoreInfo', () => {
        const testStatus = false;

        beforeEach(() => {
            nock(jiraUrl)
                .get('')
                .reply(200, '<HTML>');

            nock(utils.getRestUrl())
                .get(`/issue/${ignoredCreatorHook.issue.key}`)
                .reply(200, ignoredBody)
                .get(`/issue/${ignoreIssueKey}`)
                .times(2)
                .reply(200, ignoredBody)
                .get(`/issue/${rankHook.issue.key}`)
                .reply(200, notIgnoreCreatorIssueBody)
                .get(`/issue/${notIgnoredIssueHook.issue.key}`)
                .times(2)
                .reply(200, notIgnoreCreatorIssueBody)
                .get(`/project/${projectCreatedJSON.project.key}`)
                .reply(200, newGenNotIgnoreProject)
                .get(`/issue/${utils.getIssueId(commentCreatedHook)}`)
                .times(2)
                .reply(200, notIgnoreCreatorIssueBody)
                .get(`/issue/${linksDeletedBody.issueLink.sourceIssueId}`)
                .reply(200, notIgnoreCreatorIssueBody)
                .get(`/issue/${linksDeletedBody.issueLink.destinationIssueId}`)
                .reply(200, notIgnoreCreatorIssueBody)
                .get(`/issue/${newLinksbody.issueLink.sourceIssueId}`)
                .reply(200, notIgnoreCreatorIssueBody)
                .get(`/issue/${newLinksbody.issueLink.destinationIssueId}`)
                .reply(200, notIgnoreCreatorIssueBody);
        });

        it('Expect NOT ignore issue hook if issue is available', async () => {
            const { issueName, timestamp, webhookEvent, ignoreStatus } = await getIgnoreProject(
                notIgnoredIssueHook,
                ignnoreUsers,
                testStatus,
            );

            expect(timestamp).to.be.eq(notIgnoredIssueHook.timestamp);
            expect(webhookEvent).to.be.eq(notIgnoredIssueHook.webhookEvent);
            expect(issueName).to.be.eq(notIgnoredIssueHook.issue.key);
            expect(ignoreStatus).to.be.false;
        });

        it('Expect ignore issue hook if creater is test-user', async () => {
            const { ignoreStatus } = await getIgnoreProject(ignoredCreatorHook, ignnoreUsers, testStatus);
            expect(ignoreStatus).to.be.true;
        });

        it('Expect NOT ignore issue hook if creater is NOT test-user', async () => {
            const { ignoreStatus } = await getIgnoreProject(notIgnoredIssueHook, ignnoreUsers, testStatus);
            expect(ignoreStatus).to.be.false;
        });

        it('Expect rankHook to be ignore', async () => {
            const { issueName, timestamp, webhookEvent, ignoreStatus } = await getIgnoreProject(
                rankHook,
                ignnoreUsers,
                testStatus,
            );

            expect(timestamp).to.be.eq(rankHook.timestamp);
            expect(webhookEvent).to.be.eq(rankHook.webhookEvent);
            expect(issueName).to.be.eq(rankHook.issue.key);
            expect(ignoreStatus).to.be.true;
        });

        it('Expect IGNORE issue hook if issue is not available', async () => {
            const { issueName, timestamp, webhookEvent, ignoreStatus } = await getIgnoreProject(
                ignoredIssueHook,
                ignnoreUsers,
                testStatus,
            );

            expect(timestamp).to.be.eq(ignoredIssueHook.timestamp);
            expect(webhookEvent).to.be.eq(ignoredIssueHook.webhookEvent);
            expect(issueName).to.be.eq(ignoredIssueHook.issue.key);
            expect(ignoreStatus).to.be.true;
        });

        it('Expect NOT ignore comment create hook if issue with comment is available', async () => {
            const { issueName, timestamp, webhookEvent, ignoreStatus } = await getIgnoreProject(
                commentCreatedHook,
                ignnoreUsers,
                testStatus,
            );

            expect(timestamp).to.be.eq(commentCreatedHook.timestamp);
            expect(webhookEvent).to.be.eq(commentCreatedHook.webhookEvent);
            expect(issueName).to.be.eq(utils.getIssueId(commentCreatedHook));
            expect(ignoreStatus).to.be.false;
        });

        it('Expect IGNORE comment create hook if issue with comment is not available', async () => {
            nock.cleanAll();
            nock(jiraUrl)
                .get('')
                .reply(200, '<HTML>');

            const { issueName, timestamp, webhookEvent, ignoreStatus } = await getIgnoreProject(
                commentCreatedHook,
                ignnoreUsers,
                testStatus,
            );

            expect(timestamp).to.be.eq(commentCreatedHook.timestamp);
            expect(webhookEvent).to.be.eq(commentCreatedHook.webhookEvent);
            expect(issueName).to.be.eq(utils.getIssueId(commentCreatedHook));
            expect(ignoreStatus).to.be.true;
        });

        it('Expect getIgnoreProject to be thrown if jira is not connected', async () => {
            nock.cleanAll();
            nock(jiraUrl)
                .get('')
                .reply(404);

            let result;
            try {
                result = await getIgnoreProject(commentCreatedHook, ignnoreUsers, testStatus);
            } catch (err) {
                result = err;
            }
            expect(result).to.be.eq(messages.noJiraConnection);
        });

        it('Expect IGNORE issuelink deleted/created hook if both id are not available', async () => {
            nock.cleanAll();
            nock(jiraUrl)
                .get('')
                .reply(200, '<HTML>');
            const body = faker.random.arrayElement([linksDeletedBody, newLinksbody]);

            const { issueName, timestamp, webhookEvent, ignoreStatus } = await getIgnoreProject(
                body,
                ignnoreUsers,
                testStatus,
            );

            expect(timestamp).to.be.eq(body.timestamp);
            expect(webhookEvent).to.be.eq(body.webhookEvent);
            expect(issueName).to.be.eq(body.issueLink.id);
            expect(ignoreStatus).to.be.true;
        });

        it('Expect NOT ignore issuelink deleted/created hook if at least one of links is available', async () => {
            const [status1, status2] = faker.random.arrayElement([[404, 200], [200, 404]]);
            const body = faker.random.arrayElement([linksDeletedBody, newLinksbody]);
            nock.cleanAll();
            nock(jiraUrl)
                .get('')
                .reply(200, '<HTML>');

            nock(utils.getRestUrl())
                .get(`/issue/${body.issueLink.sourceIssueId}`)
                .times(3)
                .reply(status1, notIgnoreCreatorIssueBody)
                .get(`/issue/${body.issueLink.destinationIssueId}`)
                .times(3)
                .reply(status2, notIgnoreCreatorIssueBody);

            const { issueName, timestamp, webhookEvent, ignoreStatus } = await getIgnoreProject(
                body,
                ignnoreUsers,
                testStatus,
            );

            expect(timestamp).to.be.eq(body.timestamp);
            expect(webhookEvent).to.be.eq(body.webhookEvent);
            expect(issueName).to.be.eq(body.issueLink.id);
            expect(ignoreStatus).to.be.false;
        });

        it('Expect getIgnoreProject not ignores project_created hook', async () => {
            const { issueName, timestamp, webhookEvent, ignoreStatus } = await getIgnoreProject(
                projectCreatedJSON,
                ignnoreUsers,
                testStatus,
            );

            expect(timestamp).to.be.eq(projectCreatedJSON.timestamp);
            expect(webhookEvent).to.be.eq(projectCreatedJSON.webhookEvent);
            expect(issueName).to.be.eq(projectCreatedJSON.project.key);
            expect(ignoreStatus).to.be.false;
        });

        it('Expect getIgnoreProject ignore unknown hook type', async () => {
            const { ignoreStatus } = await getIgnoreProject(
                { ...projectCreatedJSON, webhookEvent: 'unknown_type' },
                ignnoreUsers,
                testStatus,
            );

            expect(ignoreStatus).to.be.true;
        });
    });

    describe('getNewAvatarUrl testing', () => {
        const roomId = 'TEST-1';
        const newStatusData = {
            field: 'status',
            fieldtype: 'jira',
            fieldId: 'status',
            from: '10257',
            fromString: 'To Do',
            to: '10279',
            toString: 'In Progress',
        };
        const errStatusId = 100000;
        const statusId = newStatusData.to;
        const withoutExpectedColors = {
            red: 'mxc://matrix.example/red',
            purple: 'mxc://matrix.example/purple',
            green: 'mxc://matrix.example/green',
            white: 'mxc://matrix.example/white',
            'blue-gray': 'mxc://matrix.example/blue-gray',
        };

        const expectedColorUrl = 'mxc://matrix.example/yellow';
        const usingPojects = ['TEST'];
        const colors = {
            ...withoutExpectedColors,
            [statusJSON.statusCategory.colorName]: expectedColorUrl,
        };

        beforeEach(() => {
            nock(utils.getRestUrl())
                .get(`/status/${newStatusData.to}`)
                .reply(200, statusJSON)
                .get(`/status/${errStatusId}`)
                .reply(404);
        });

        it('Expect getNewAvatarUrl should return undefined if no statusId is put', async () => {
            const res = await getNewAvatarUrl(roomId, { colors });
            expect(res).to.be.undefined;
        });

        it('Expect getNewAvatarUrl should return undefined if no colors is put', async () => {
            const res = await getNewAvatarUrl(roomId, { statusId });
            expect(res).to.be.undefined;
        });

        it('Expect getNewAvatarUrl should return correct color if statusId have this field id color link', async () => {
            const res = await getNewAvatarUrl(roomId, {
                colors,
                statusId,
                usingPojects,
            });
            expect(res).to.be.eq(expectedColorUrl);
        });

        it('Expect getNewAvatarUrl should return correct color if statusId have this field id color link and all project passed ({usingPojects: "all"})', async () => {
            const res = await getNewAvatarUrl(roomId, {
                colors,
                statusId,
                usingPojects: 'all',
            });
            expect(res).to.be.eq(expectedColorUrl);
        });

        it('Expect getNewAvatarUrl should return undefined if project is not exists in using projects', async () => {
            const res = await getNewAvatarUrl(roomId, {
                colors,
                statusId,
                usingPojects: ['NOTTEST'],
            });
            expect(res).to.be.undefined;
        });

        it('Expect getNewAvatarUrl should return undefined if project is not exists in using projects (empty array)', async () => {
            const res = await getNewAvatarUrl(roomId, {
                colors,
                statusId,
                usingPojects: [],
            });
            expect(res).to.be.undefined;
        });

        it('Expect getNewAvatarUrl should return undefined if project is not exists in using projects (empty project field)', async () => {
            const res = await getNewAvatarUrl(roomId, {
                colors,
                statusId,
            });
            expect(res).to.be.undefined;
        });

        it('Expect getNewAvatarUrl should return undefined if color is not exists in our colors data', async () => {
            const res = await getNewAvatarUrl(roomId, { colors: withoutExpectedColors, statusId });
            expect(res).to.be.undefined;
        });

        it('Expect getNewAvatarUrl should return undefined if request to get color has error inside', async () => {
            const res = await getNewAvatarUrl(roomId, { colors, statusId: errStatusId });
            expect(res).to.be.undefined;
        });
    });
});
