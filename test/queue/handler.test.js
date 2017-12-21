const assert = require('assert');
const nock = require('nock');
const logger = require('../../src/modules/log.js')(module);
const firstBody = require('../fixtures/comment-create-1.json');
const jsonBody = require('../fixtures/comment-create-3.json');
const Matrix = require('../../src/matrix/');
const {postStatusData} = require('../../src/bot/helper');
const {getPostEpicUpdatesData} = require('../../src/queue/parse-body');
const {getNewIssueMessageBody} = require('../../src/bot/post-epic-updates');

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
});
