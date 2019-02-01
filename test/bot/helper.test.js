const projectCreatedJSON = require('../fixtures/webhooks/project/created.json');
const issueCreatedJSON = require('../fixtures/webhooks/issue/created.json');
const {getCreateRoomData} = require('../../src/jira-hook-parser/parse-body.js');
const renderedIssueJSON = require('../fixtures/jira-api-requests/issue-rendered.json');
const htmlToText = require('html-to-text').fromString;
const faker = require('faker');
const newLinksbody = require('../fixtures/webhooks/issuelink/created.json');
const linksDeletedBody = require('../fixtures/webhooks/issuelink/deleted.json');
const {jira: {url: jiraUrl}} = require('../../src/config');
const assert = require('assert');
const projectBody = require('../fixtures/jira-api-requests/project.json');
const commentCreatedHook = require('../fixtures/webhooks/comment/created.json');
const issueChangedHook = require('../fixtures/webhooks/issue/updated/commented-changed.json');
const issueBody = require('../fixtures/jira-api-requests/issue.json');
const utils = require('../../src/lib/utils');
const messages = require('../../src/lib/messages');
const nock = require('nock');

const proxyquire = require('proxyquire');
const chai = require('chai');
const {expect} = chai;

const {
    getMembersUserId,
    getPostStatusData,
    getIgnoreBodyData,
    getIgnoreInfo,
    getIgnoreProject,
    getDescription,
} = require('../../src/bot/helper.js');

const {getIgnoreBodyData: isIgnoreStub} = proxyquire('../../src/bot/helper.js', {
    '../config': {
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

    it('getMembersUserId test', () => {
        const data = [
            {userId: 'one', other: 'a'},
            {userId: 'two', other: 'b'},
            {userId: 'three', other: 'c'},
        ];

        const result = getMembersUserId(data);
        expect(result).to.deep.equal(['one', 'two', 'three']);
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
                        name: '',
                    },
                },
            };
            const changelog = {};
            const newBody = {...issueChangedHook, issue, user, changelog};
            const {username, creator, ignoreStatus} = getIgnoreBodyData(newBody);

            expect(username).to.equal('bot');
            expect(creator).to.equal('');
            expect(ignoreStatus).to.be.true;
        });
    });

    describe('Test getIgnoreBodyData in mode production (not test)', () => {
        it('test mode false with no changelog', () => {
            const newBody = {...issueChangedHook, changelog: {}};
            const {username, creator, ignoreStatus} = isIgnoreStub(newBody);

            expect(username).to.equal('jira_test');
            expect(creator).to.equal('jira_test');
            expect(ignoreStatus).to.be.false;
        });

        it('test mode true with ignore username', () => {
            const user = {
                name: 'ivan_prod',
            };
            const newBody = {...issueChangedHook, changelog: {}, user};
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
        const description = htmlToText(renderedIssueJSON.renderedFields.description);
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
                .get(`/issue/${issueCreatedJSON.issue.id}`)
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
        const privateKey = 'KEY';
        const privateId = 12345;
        const commentUrl = utils.getRestUrl('issue', privateId, 'comment', commentCreatedHook.comment.id);
        const privateCommentHook = {...commentCreatedHook, comment: {...commentCreatedHook.comment, self: commentUrl}};
        const privateHook = {
            ...issueChangedHook,
            issue: {...issueChangedHook.issue, key: `${privateKey}-1`, fields: {project: {key: privateKey}}},
        };

        beforeEach(() => {
            nock(jiraUrl)
                .get('')
                .times(2)
                .reply(200, '<HTML>');

            nock(utils.getRestUrl())
                .get(`/project/${projectCreatedJSON.project.key}`)
                .reply(200, projectBody)
                .get(`/project/${issueChangedHook.issue.fields.project.key}`)
                .times(4)
                .reply(200, projectBody)
                .get(`/project/${privateKey}`)
                .times(3)
                .reply(200, {...projectBody, isPrivate: true})
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
                .reply(200, issueBody)
                .get(`/issue/${privateId}`)
                .reply(404);
        });

        afterEach(() => {
            nock.cleanAll();
        });

        it('Expect getIgnoreInfo return correct body', async () => {
            const result = await getIgnoreInfo(issueChangedHook);

            const userStatus = getIgnoreBodyData(issueChangedHook);
            const projectStatus = await getIgnoreProject(issueChangedHook);
            const status = userStatus.ignoreStatus || projectStatus.ignoreStatus;

            expect(result).to.be.deep.eq({userStatus, projectStatus, status});
        });

        it('Expect getIgnoreProject handle hook correct if project is new-gen', async () => {
            const {issueName, timestamp, webhookEvent, ignoreStatus} = await getIgnoreProject(issueChangedHook);

            expect(timestamp).to.be.eq(issueChangedHook.timestamp);
            expect(webhookEvent).to.be.eq(issueChangedHook.webhookEvent);
            expect(issueName).to.be.eq(issueChangedHook.issue.key);
            expect(ignoreStatus).to.be.false;
        });

        it('Expect getIgnoreProject handle hook correct if project is classic', async () => {
            nock.cleanAll();
            nock(jiraUrl).get('').reply(200, '<HTML>');
            nock(utils.getRestUrl(), {reqheaders: {Authorization: utils.auth()}})
                .get(`/project/${issueChangedHook.issue.fields.project.key}`)
                .reply(200, {...projectBody, style: 'classic'})
                .get(`/issue/${issueChangedHook.issue.key}`)
                .reply(200, issueBody);

            const {issueName, timestamp, webhookEvent, ignoreStatus} = await getIgnoreProject(issueChangedHook);

            expect(timestamp).to.be.eq(issueChangedHook.timestamp);
            expect(webhookEvent).to.be.eq(issueChangedHook.webhookEvent);
            expect(issueName).to.be.eq(issueChangedHook.issue.key);
            expect(ignoreStatus).to.be.false;
        });

        it('Expect hook to be handled and to be ignored if project is private and new-gen', async () => {
            const {issueName, timestamp, webhookEvent, ignoreStatus} = await getIgnoreProject(privateHook);

            expect(timestamp).to.be.eq(privateHook.timestamp);
            expect(webhookEvent).to.be.eq(privateHook.webhookEvent);
            expect(issueName).to.be.eq(privateHook.issue.key);
            expect(ignoreStatus).to.be.true;
        });

        it('Expect comment create hook to be handled', async () => {
            const {issueName, timestamp, webhookEvent, ignoreStatus} = await getIgnoreProject(commentCreatedHook);

            expect(timestamp).to.be.eq(commentCreatedHook.timestamp);
            expect(webhookEvent).to.be.eq(commentCreatedHook.webhookEvent);
            expect(issueName).to.be.eq(utils.getIssueId(commentCreatedHook));
            expect(ignoreStatus).to.be.false;
        });

        it('Expect createRoom hook to be handled and should be ignored if private issue', async () => {
            const {issueName, timestamp, webhookEvent, ignoreStatus} = await getIgnoreProject(privateCommentHook);

            expect(timestamp).to.be.eq(commentCreatedHook.timestamp);
            expect(webhookEvent).to.be.eq(commentCreatedHook.webhookEvent);
            expect(issueName).to.be.eq(String(privateId));
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

        it('Expect getIgnoreProject to have "true" status with issuelink deleted/created if both id are not available', async () => {
            nock.cleanAll();
            nock(jiraUrl).get('').reply(200, '<HTML>');
            const body = faker.random.arrayElement([linksDeletedBody, newLinksbody]);

            const {issueName, timestamp, webhookEvent, ignoreStatus} = await getIgnoreProject(body);

            expect(timestamp).to.be.eq(body.timestamp);
            expect(webhookEvent).to.be.eq(body.webhookEvent);
            expect(issueName).to.be.eq(body.issueLink.id);
            expect(ignoreStatus).to.be.true;
        });

        it('Expect getIgnoreProject to have "false" status with issuelink deleted/created if one of links is available', async () => {
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
            // TODO add issue id
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
    });
});
