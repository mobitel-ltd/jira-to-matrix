const {jira: {url: jiraUrl}} = require('../../src/config');
const assert = require('assert');
const firstBody = require('../fixtures/comment-create-1.json');
const thirdBody = require('../fixtures/comment-create-3.json');
const secondBody = require('../fixtures/comment-create-2.json');
const utils = require('../../src/lib/utils');
const messages = require('../../src/lib/messages');
const {getPostProjectUpdatesData, getPostEpicUpdatesData} = require('../../src/jira-hook-parser/parse-body');
// const {getBodyProjectId} = require('../../src/lib/utils');
const nock = require('nock');

const proxyquire = require('proxyquire');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

const {
    isStartEndUpdateStatus,
    membersInvited,
    postStatusData,
    getEpicChangedMessageBody,
    getNewEpicMessageBody,
    getNewIssueMessageBody,
    getUserID,
    getIgnoreBodyData,
    getIgnoreInfo,
    getIgnoreProject,
} = require('../../src/bot/helper.js');

const {getIgnoreBodyData: isIgnoreStub} = proxyquire('../../src/bot/helper.js', {
    '../config': {
        testMode: {
            on: false,
        },
    },
});

describe('Helper tests', () => {
    it('getEpicChangedMessageBody', () => {
        const {data} = getPostProjectUpdatesData(secondBody);

        const {body, htmlBody} = getEpicChangedMessageBody(data);

        assert.equal(body, 'Эпик изменён');

        const expected = `<p>${data.name} изменил(а) статус связанного эпика <a href="https://jira.test-example.ru/jira/browse/BBCOM-956">${data.key} &quot;${data.summary}&quot;</a> на <strong>${data.status}</strong></p>\n`;
        assert.equal(htmlBody, expected);
    });

    it('getNewEpicMessageBody', () => {
        const {data} = getPostProjectUpdatesData(secondBody);

        const {body, htmlBody} = getNewEpicMessageBody(data);

        assert.equal(body, 'Новый эпик в проекте');

        const expected = `<p>К проекту добавлен эпик <a href="https://jira.test-example.ru/jira/browse/BBCOM-956">${data.key} ${data.summary}</a></p>\n`;
        assert.equal(htmlBody, expected);
    });

    it('postStatusData', () => {
        const {data} = getPostEpicUpdatesData(thirdBody);
        const {body, htmlBody} = postStatusData(data);

        assert.equal(body, 'BBCOM-956 "BBCOM-956" теперь в статусе "Closed"');

        const expected = `<p>jira_test изменил(а) статус связанной задачи <a href="https://jira.test-example.ru/jira/browse/BBCOM-956">BBCOM-956 &quot;BBCOM-956&quot;</a> на <strong>Closed</strong></p>\n`;
        assert.equal(htmlBody, expected);
    });

    it('postStatusData with null', () => {
        const data = {
            key: 'BBCOM-956',
            summary: 'BBCOM-956',
            id: '26313',
            changelog: null,
            name: 'jira_test',
        };

        const {body, htmlBody} = postStatusData(data);
        assert.equal(body, null);
        assert.equal(htmlBody, null);
    });

    it('getNewIssueMessageBody', () => {
        const data = {
            key: 'BBCOM-956',
            summary: 'lalalla',
            id: '26313',
            changelog: null,
            name: 'jira_test',
        };

        const {body, htmlBody} = getNewIssueMessageBody(data);
        assert.equal(body, 'Новая задача в эпике');
        assert.equal(htmlBody, '<p>К эпику добавлена задача <a href="https://jira.test-example.ru/jira/browse/BBCOM-956">BBCOM-956 lalalla</a></p>\n');
    });

    it('membersInvited test', () => {
        const data = [
            {userId: 'one', other: 'a'},
            {userId: 'two', other: 'b'},
            {userId: 'three', other: 'c'},
        ];

        const result = membersInvited(data);
        expect(result).to.deep.equal(['one', 'two', 'three']);
    });

    it('getUserID test', () => {
        const name = 'BBCOM';
        const result = getUserID(name);

        expect(result).to.equal('@BBCOM:matrix.test-example.ru');
    });

    it('isStartEndUpdateStatus test', () => {
        const trueResult = isStartEndUpdateStatus(thirdBody);
        expect(trueResult).to.be.true;

        const changelog = {
            items: [
                {
                    field: 'Start date',
                },
            ],
        };

        const newBody = {...thirdBody, changelog};
        const endResult = isStartEndUpdateStatus(newBody);
        expect(endResult).to.be.true;

        const falseResult = isStartEndUpdateStatus(secondBody);
        expect(falseResult).to.be.false;
    });

    describe('Test getIgnoreBodyData', () => {
        it('ignore if startEndUpdateStatus is true  but users are common', () => {
            const {username, creator, startEndUpdateStatus, ignoreStatus} = getIgnoreBodyData(thirdBody);

            expect(username).to.equal('jira_test');
            expect(creator).to.equal('jira_test');
            expect(startEndUpdateStatus).to.be.true;
            expect(ignoreStatus).to.be.true;
        });

        it('not ignore if startEndUpdateStatus is false', () => {
            const newBody = {...thirdBody, changelog: {}};
            const {startEndUpdateStatus, username, creator, ignoreStatus} = getIgnoreBodyData(newBody);

            expect(username).to.equal('jira_test');
            expect(creator).to.equal('jira_test');
            expect(startEndUpdateStatus).to.be.false;
            expect(ignoreStatus).to.be.false;
        });

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
            const newBody = {...thirdBody, issue, user, changelog};
            const {username, creator, ignoreStatus} = getIgnoreBodyData(newBody);

            expect(username).to.equal('bot');
            expect(creator).to.equal('');
            expect(ignoreStatus).to.be.true;
        });

        it('test ignore start/end only end or start', () => {
            const changelog = {
                items: [
                    {
                        field: 'End date',
                    },
                ],
            };

            const newBody = {...thirdBody, changelog};
            const {ignoreStatus} = getIgnoreBodyData(newBody);

            expect(ignoreStatus).to.be.true;
        });
    });

    describe('Test getIgnoreBodyData in mode production (not test)', () => {
        it('test mode true  with ignore start/end', () => {
            const {username, creator, ignoreStatus} = isIgnoreStub(thirdBody);

            expect(username).to.equal('jira_test');
            expect(creator).to.equal('jira_test');
            expect(ignoreStatus).to.be.true;
        });


        it('test mode false with no changelog', () => {
            const newBody = {...thirdBody, changelog: {}};
            const {username, creator, ignoreStatus} = isIgnoreStub(newBody);

            expect(username).to.equal('jira_test');
            expect(creator).to.equal('jira_test');
            expect(ignoreStatus).to.be.false;
        });

        it('test mode true with ignore username', () => {
            const user = {
                name: 'ivan_prod',
            };
            const newBody = {...thirdBody, changelog: {}, user};
            const {username, creator, ignoreStatus} = isIgnoreStub(newBody);

            expect(username).to.equal('ivan_prod');
            expect(creator).to.equal('jira_test');
            expect(ignoreStatus).to.be.true;
        });
    });

    describe('Test getIgnoreInfo', () => {
        const privateId = 12345;
        const self = `https://jira.test-example.ru/jira/rest/api/2/issue/${privateId}/comment/31039`;
        const privateCommentHook = {...firstBody, comment: {...firstBody.comment, self}};
        const privateHook = {...thirdBody, issue: {...thirdBody.issue, fields: {project: {id: privateId}}}};

        before(() => {
            nock(jiraUrl)
                .get('')
                .times(2)
                .reply(200, '<HTML>')
                .get(`/${utils.JIRA_REST}/project/${thirdBody.issue.fields.project.id}`)
                .times(5)
                .reply(200, {isPrivate: false})
                .get(`/${utils.JIRA_REST}/project/${privateId}`)
                .times(1)
                .reply(200, {isPrivate: true})
                .get(`/${utils.JIRA_REST}/issue/${utils.extractID(firstBody)}`)
                .times(2)
                .reply(200, {isPrivate: false})
                .get(`/${utils.JIRA_REST}/issue/${privateId}`)
                .times(1)
                .reply(404);
        });

        after(() => {
            nock.cleanAll();
        });

        it('Expect getIgnoreInfo return correct body', async () => {
            const result = await getIgnoreInfo(thirdBody);

            const userStatus = getIgnoreBodyData(thirdBody);
            const projectStatus = await getIgnoreProject(thirdBody);

            expect(result).to.be.deep.eq({userStatus, projectStatus});
        });

        it('Expect getIgnoreProject handle hook correct', async () => {
            const {issueName, timestamp, webhookEvent, ignoreStatus} = await getIgnoreProject(thirdBody);

            expect(timestamp).to.be.eq(thirdBody.timestamp);
            expect(webhookEvent).to.be.eq(thirdBody.webhookEvent);
            expect(issueName).to.be.eq(thirdBody.issue.key);
            expect(ignoreStatus).to.be.false;
        });

        it('Expect hook to be handled and to be ignored if project is private', async () => {
            const {issueName, timestamp, webhookEvent, ignoreStatus} = await getIgnoreProject(privateHook);

            expect(timestamp).to.be.eq(privateHook.timestamp);
            expect(webhookEvent).to.be.eq(privateHook.webhookEvent);
            expect(issueName).to.be.eq(privateHook.issue.key);
            expect(ignoreStatus).to.be.true;
        });

        it('Expect createRoom hook to be handled', async () => {
            const {issueName, timestamp, webhookEvent, ignoreStatus} = await getIgnoreProject(firstBody);

            expect(timestamp).to.be.eq(firstBody.timestamp);
            expect(webhookEvent).to.be.eq(firstBody.webhookEvent);
            expect(issueName).to.be.eq(utils.extractID(firstBody));
            expect(ignoreStatus).to.be.false;
        });

        it('Expect createRoom hook to be handled and should be ignored if private issue', async () => {
            const {issueName, timestamp, webhookEvent, ignoreStatus} = await getIgnoreProject(privateCommentHook);

            expect(timestamp).to.be.eq(firstBody.timestamp);
            expect(webhookEvent).to.be.eq(firstBody.webhookEvent);
            expect(issueName).to.be.eq(String(privateId));
            expect(ignoreStatus).to.be.true;
        });

        it('Expect getIgnoreProject to be thrown if jira is not connected', async () => {
            let result;
            try {
                result = await getIgnoreProject(firstBody);
            } catch (err) {
                result = err;
            }
            expect(result).to.be.eq(messages.noJiraConnection);
        });
    });
});
