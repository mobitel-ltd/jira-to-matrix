const projectCreatedJSON = require('../fixtures/webhooks/project/created.json');
const issueCreatedJSON = require('../fixtures/webhooks/issue/created.json');
const {getCreateRoomData} = require('../../src/jira-hook-parser/parse-body.js');
const renderedIssueJSON = require('../fixtures/jira-api-requests/issue-rendered.json');
const htmlToText = require('html-to-text').fromString;
const faker = require('faker');
const marked = require('marked');
const newLinksbody = require('../fixtures/webhooks/issuelink/created.json');
const linksDeletedBody = require('../fixtures/webhooks/issuelink/deleted.json');
const {jira: {url: jiraUrl}} = require('../../src/config');
const assert = require('assert');

const testNewUserAssignBody = require('../fixtures/webhooks/issue/updated/issue-assigned.json');
const newGenNotIgnoreProject = require('../fixtures/jira-api-requests/project-gens/new-gen/correct.json');
const commentCreatedHook = require('../fixtures/webhooks/comment/created.json');
const notIgnoredIssueHook = require('../fixtures/webhooks/issue/updated/commented-changed.json');
const ignoredIssueHook = require('../fixtures/webhooks/issue/updated/generic.json');
const issueBody = require('../fixtures/jira-api-requests/issue.json');
const rankHook = require('../fixtures/webhooks/issue/updated/rank-changed.json');
const utils = require('../../src/lib/utils');
const messages = require('../../src/lib/messages');
const nock = require('nock');

const proxyquire = require('proxyquire');
const chai = require('chai');
const {expect} = chai;

const {
    getPostStatusData,
    getIgnoreBodyData,
    getIgnoreProject,
    getDescription,
} = require('../../src/bot/actions/helper.js');

const {getIgnoreBodyData: isIgnoreStub} = proxyquire('../../src/bot/actions/helper.js', {
    '../../config': {
        testMode: {
            on: false,
        },
    },
});

describe('Helper tests', () => {
    it('getPostStatusData with null', () => {
        const data = {
            key: 'BBCOM-956',
            summary: 'BBCOM-956',
            id: '26313',
            changelog: null,
            name: 'jira_test',
        };

        const {body, htmlBody} = getPostStatusData(data);
        assert.equal(body, null);
        assert.equal(htmlBody, null);
    });

    describe('Test getIgnoreBodyData', () => {
        it('not ignore user, creator, status', () => {
            const user = {
                name: 'bot',
            };
            const issue = {
                fields: {
                    comment: '',
                    creator: {
                        emailAddress: '123',
                    },
                },
            };
            const changelog = {};
            const newBody = {...notIgnoredIssueHook, issue, user, changelog};
            const {username, creator, ignoreStatus} = getIgnoreBodyData(newBody);

            expect(username).to.equal('bot');
            expect(creator).to.equal('123');
            expect(ignoreStatus).to.be.true;
        });

        it('expect issue_update not to be ignore', () => {
            const {username, creator, ignoreStatus} = getIgnoreBodyData(testNewUserAssignBody);

            expect(username).to.equal('jira_test');
            expect(creator).to.equal('jira_test');
            expect(ignoreStatus).to.be.false;
        });
    });

    describe('Test getIgnoreBodyData in mode production (not test)', () => {
        it('test mode false with no changelog', () => {
            const newBody = {...notIgnoredIssueHook, changelog: {}};
            const {username, creator, ignoreStatus} = isIgnoreStub(newBody);

            expect(username).to.equal('jira_test');
            expect(creator).to.equal('jira_test');
            expect(ignoreStatus).to.be.false;
        });

        it('test mode true with ignore username', () => {
            const user = {
                name: 'ivan_prod',
            };
            const newBody = {...notIgnoredIssueHook, changelog: {}, user};
            const {username, creator, ignoreStatus} = isIgnoreStub(newBody);

            expect(username).to.equal('ivan_prod');
            expect(creator).to.equal('jira_test');
            expect(ignoreStatus).to.be.true;
        });
    });

    describe('geDescription test', () => {
        const createRoomData = getCreateRoomData(issueCreatedJSON);

        const epicKey = createRoomData.issue.descriptionFields.epicLink;

        const {descriptionFields} = createRoomData.issue;
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

        after(() => {
            nock.cleanAll();
        });

        it('Description with epic should be created', async () => {
            const result = await getDescription(createRoomData.issue);
            expect(result).deep.eq({body: expectedBody, htmlBody: expectedHTMLBody});
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
        beforeEach(() => {
            nock(jiraUrl)
                .get('')
                .reply(200, '<HTML>');

            nock(utils.getRestUrl())
                .get(`/issue/${rankHook.issue.key}`)
                .reply(200, issueBody)
                .get(`/issue/${notIgnoredIssueHook.issue.key}`)
                .reply(200, issueBody)
                .get(`/project/${projectCreatedJSON.project.key}`)
                .reply(200, newGenNotIgnoreProject)
                .get(`/issue/${utils.getIssueId(commentCreatedHook)}`)
                .times(2)
                .reply(200, issueBody)
                .get(`/issue/${linksDeletedBody.issueLink.sourceIssueId}`)
                .reply(200, issueBody)
                .get(`/issue/${linksDeletedBody.issueLink.destinationIssueId}`)
                .reply(200, issueBody)
                .get(`/issue/${newLinksbody.issueLink.sourceIssueId}`)
                .reply(200, issueBody)
                .get(`/issue/${newLinksbody.issueLink.destinationIssueId}`)
                .reply(200, issueBody);
        });

        afterEach(() => {
            nock.cleanAll();
        });

        it('Expect NOT ignore issue hook if issue is available', async () => {
            const {issueName, timestamp, webhookEvent, ignoreStatus} = await getIgnoreProject(notIgnoredIssueHook);

            expect(timestamp).to.be.eq(notIgnoredIssueHook.timestamp);
            expect(webhookEvent).to.be.eq(notIgnoredIssueHook.webhookEvent);
            expect(issueName).to.be.eq(notIgnoredIssueHook.issue.key);
            expect(ignoreStatus).to.be.false;
        });

        it('Expect rankHook to be ignore', async () => {
            const {issueName, timestamp, webhookEvent, ignoreStatus} = await getIgnoreProject(rankHook);

            expect(timestamp).to.be.eq(rankHook.timestamp);
            expect(webhookEvent).to.be.eq(rankHook.webhookEvent);
            expect(issueName).to.be.eq(rankHook.issue.key);
            expect(ignoreStatus).to.be.true;
        });

        it('Expect IGNORE issue hook if issue is not available', async () => {
            const {issueName, timestamp, webhookEvent, ignoreStatus} = await getIgnoreProject(ignoredIssueHook);

            expect(timestamp).to.be.eq(ignoredIssueHook.timestamp);
            expect(webhookEvent).to.be.eq(ignoredIssueHook.webhookEvent);
            expect(issueName).to.be.eq(ignoredIssueHook.issue.key);
            expect(ignoreStatus).to.be.true;
        });

        it('Expect NOT ignore comment create hook if issue with comment is available', async () => {
            const {issueName, timestamp, webhookEvent, ignoreStatus} = await getIgnoreProject(commentCreatedHook);

            expect(timestamp).to.be.eq(commentCreatedHook.timestamp);
            expect(webhookEvent).to.be.eq(commentCreatedHook.webhookEvent);
            expect(issueName).to.be.eq(utils.getIssueId(commentCreatedHook));
            expect(ignoreStatus).to.be.false;
        });

        it('Expect IGNORE comment create hook if issue with comment is not available', async () => {
            nock.cleanAll();
            nock(jiraUrl).get('').reply(200, '<HTML>');

            const {issueName, timestamp, webhookEvent, ignoreStatus} = await getIgnoreProject(commentCreatedHook);

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
                result = await getIgnoreProject(commentCreatedHook);
            } catch (err) {
                result = err;
            }
            expect(result).to.be.eq(messages.noJiraConnection);
        });

        it('Expect IGNORE issuelink deleted/created hook if both id are not available', async () => {
            nock.cleanAll();
            nock(jiraUrl).get('').reply(200, '<HTML>');
            const body = faker.random.arrayElement([linksDeletedBody, newLinksbody]);

            const {issueName, timestamp, webhookEvent, ignoreStatus} = await getIgnoreProject(body);

            expect(timestamp).to.be.eq(body.timestamp);
            expect(webhookEvent).to.be.eq(body.webhookEvent);
            expect(issueName).to.be.eq(body.issueLink.id);
            expect(ignoreStatus).to.be.true;
        });

        it('Expect NOT ignore issuelink deleted/created hook if at least one of links is available', async () => {
            const [status1, status2] = faker.random.arrayElement([[404, 200], [200, 404]]);
            const body = faker.random.arrayElement([linksDeletedBody, newLinksbody]);
            nock.cleanAll();
            nock(jiraUrl).get('').reply(200, '<HTML>');

            nock(utils.getRestUrl())
                .get(`/issue/${body.issueLink.sourceIssueId}`)
                .reply(status1, issueBody)
                .get(`/issue/${body.issueLink.destinationIssueId}`)
                .reply(status2, issueBody);

            const {issueName, timestamp, webhookEvent, ignoreStatus} = await getIgnoreProject(body);

            expect(timestamp).to.be.eq(body.timestamp);
            expect(webhookEvent).to.be.eq(body.webhookEvent);
            expect(issueName).to.be.eq(body.issueLink.id);
            expect(ignoreStatus).to.be.false;
        });

        it('Expect getIgnoreProject not ignores project_created hook', async () => {
            const {issueName, timestamp, webhookEvent, ignoreStatus} = await getIgnoreProject(projectCreatedJSON);

            expect(timestamp).to.be.eq(projectCreatedJSON.timestamp);
            expect(webhookEvent).to.be.eq(projectCreatedJSON.webhookEvent);
            expect(issueName).to.be.eq(projectCreatedJSON.project.key);
            expect(ignoreStatus).to.be.false;
        });

        it('Expect getIgnoreProject ignore unknown hook type', async () => {
            const {ignoreStatus} = await getIgnoreProject({...projectCreatedJSON, webhookEvent: 'unknown_type'});

            expect(ignoreStatus).to.be.true;
        });
    });
});
