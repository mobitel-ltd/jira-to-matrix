const assert = require('assert');
const nock = require('nock');
const issueCommentedHook = require('../fixtures/webhooks/issue/updated/commented.json');
const jsonBody = require('../fixtures/webhooks/issue/updated/commented-changed.json');
const {postStatusData} = require('../../src/bot/helper');
const {getPostProjectUpdatesData, getPostEpicUpdatesData} = require('../../src/jira-hook-parser/parse-body');
const {getNewIssueMessageBody, getEpicChangedMessageBody, getNewEpicMessageBody} = require('../../src/bot/helper.js');

describe('bot func', () => {
    before(() => {
        nock('https://matrix.test-example.ru')
            .get('/')
            .reply(200, {result: true});
    });

    it('postStatusData', () => {
        const {data} = getPostEpicUpdatesData(jsonBody);
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
            name: 'jira_test',
        };

        const {body} = postStatusData(data);
        assert.equal(body, null);
    });

    it('getNewIssueMessageBody', () => {
        const data = {
            key: 'BBCOM-956',
            summary: 'lalalla',
            id: '26313',
            name: 'jira_test',
        };

        const {body, htmlBody} = getNewIssueMessageBody(data);
        assert.equal(body, 'Новая задача в эпике');
        assert.equal(htmlBody, '<p>К эпику добавлена задача <a href="https://jira.test-example.ru/jira/browse/BBCOM-956">BBCOM-956 lalalla</a></p>\n');
    });

    it('getEpicChangedMessageBody', () => {
        const {data} = getPostProjectUpdatesData(issueCommentedHook);

        const {body, htmlBody} = getEpicChangedMessageBody(data);
        assert.equal(body, 'Эпик изменён');
        const expected = `<p>${data.name} изменил(а) статус связанного эпика <a href="https://jira.test-example.ru/jira/browse/BBCOM-956">${data.key} &quot;${data.summary}&quot;</a> на <strong>${data.status}</strong></p>\n`;
        assert.equal(htmlBody, expected);
    });

    it('getEpicChangedMessageBody', () => {
        const {data} = getPostProjectUpdatesData(issueCommentedHook);
        const {body, htmlBody} = getEpicChangedMessageBody(data);

        assert.equal(body, 'Эпик изменён');
        const expected = `<p>${data.name} изменил(а) статус связанного эпика <a href="https://jira.test-example.ru/jira/browse/BBCOM-956">${data.key} &quot;${data.summary}&quot;</a> на <strong>${data.status}</strong></p>\n`;
        assert.equal(htmlBody, expected);
    });

    it('getNewEpicMessageBody', () => {
        const {data} = getPostProjectUpdatesData(issueCommentedHook);

        const {body, htmlBody} = getNewEpicMessageBody(data);

        assert.equal(body, 'Новый эпик в проекте');
        const expected = `<p>К проекту добавлен эпик <a href="https://jira.test-example.ru/jira/browse/BBCOM-956">${data.key} ${data.summary}</a></p>\n`;
        assert.equal(htmlBody, expected);
    });
});
