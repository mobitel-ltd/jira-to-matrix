const assert = require('assert');
const nock = require('nock');
const logger = require('../../src/modules/log.js')(module);
const firstBody = require('../fixtures/comment-create-1.json');
const secondBody = require('../fixtures/comment-create-2.json');
const jsonBody = require('../fixtures/comment-create-3.json');
const Matrix = require('../../src/matrix/');
const {postStatusData} = require('../../src/bot/helper');
const {getPostProjectUpdatesData, getPostEpicUpdatesData} = require('../../src/queue/parse-body');
const {getNewIssueMessageBody, getEpicChangedMessageBody, getNewEpicMessageBody} = require('../../src/bot/helper.js');

describe('bot func', function() {
    this.timeout(15000);
    before(() => {
        nock('https://matrix.bingo-boom.ru')
            .get('/')
            .reply(200, {result: true});
    })

    it('error sendHtmlMessage', async () => {
        try {
            const mclient = await Matrix.connect();
            await mclient.sendHtmlMessage(null);
        } catch (err) {
            logger.debug('error', err);
            assert.ok(err);
            Matrix.disconnect();
        }
    });

    it('postStatusData', async () => {
        const {data} = getPostEpicUpdatesData(jsonBody);
        logger.debug('data', data);
        const {body, htmlBody} = postStatusData(data);
        assert.equal(body, 'BBCOM-956 "BBCOM-956" теперь в статусе "Closed"');
        const expected = `<p>jira_test изменил(а) статус связанной задачи <a href="https://jira.bingo-boom.ru/jira/browse/BBCOM-956">BBCOM-956 &quot;BBCOM-956&quot;</a> на <strong>Closed</strong></p>\n`;
        assert.equal(htmlBody, expected);
    });

    it('postStatusData with null', async () => {
        const data = {
            key: 'BBCOM-956',
            summary: 'BBCOM-956',
            id: '26313',
            changelog: undefined,
            name: 'jira_test',
        };

        logger.debug('data', data);
        const {body, htmlBody} = postStatusData(data);
        assert.equal(body, null);
    });

    it('getNewIssueMessageBody', async () => {
        const data = {
            key: 'BBCOM-956',
            summary: 'lalalla',
            id: '26313',
            changelog: undefined,
            name: 'jira_test',
        };

        const {body, htmlBody} = getNewIssueMessageBody(data);
        logger.debug('data', {body, htmlBody});
        assert.equal(body, 'Новая задача в эпике');
        assert.equal(htmlBody, '<p>К эпику добавлена задача <a href="https://jira.bingo-boom.ru/jira/browse/BBCOM-956">BBCOM-956 lalalla</a></p>\n');
    });

    it('getEpicChangedMessageBody', async () => {
        const {data} = getPostProjectUpdatesData(secondBody);
        logger.debug('getPostProjectUpdatesData', data);

        const {body, htmlBody} = getEpicChangedMessageBody(data);
        logger.debug('data', {body, htmlBody});
        assert.equal(body, 'Эпик изменён');
        const expected = `<p>${data.name} изменил(а) статус связанного эпика <a href="https://jira.bingo-boom.ru/jira/browse/BBCOM-956">${data.key} &quot;${data.summary}&quot;</a> на <strong>${data.status}</strong></p>\n`
        assert.equal(htmlBody, expected);
    });

    it('getEpicChangedMessageBody', async () => {
        const {data} = getPostProjectUpdatesData(secondBody);
        logger.debug('getPostProjectUpdatesData', data);

        const {body, htmlBody} = getEpicChangedMessageBody(data);

        assert.equal(body, 'Эпик изменён');
        const expected = `<p>${data.name} изменил(а) статус связанного эпика <a href="https://jira.bingo-boom.ru/jira/browse/BBCOM-956">${data.key} &quot;${data.summary}&quot;</a> на <strong>${data.status}</strong></p>\n`;
        assert.equal(htmlBody, expected);
    });

    it('getNewEpicMessageBody', async () => {
        const {data} = getPostProjectUpdatesData(secondBody);
        logger.debug('getPostProjectUpdatesData', data);

        const {body, htmlBody} = getNewEpicMessageBody(data);

        assert.equal(body, 'Новый эпик в проекте');
        `<p>К проекту добавлен эпик <a href="https://jira.bingo-boom.ru/jira/browse/BBCOM-956">${data.key} ${data.summary}</a></p>`
        const expected = `<p>К проекту добавлен эпик <a href="https://jira.bingo-boom.ru/jira/browse/BBCOM-956">${data.key} ${data.summary}</a></p>\n`;
        assert.equal(htmlBody, expected);
    });

});
