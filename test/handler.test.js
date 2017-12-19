const assert = require('assert');
const logger = require('../src/modules/log.js')(module);
const firstBody = require('./fixtures/comment-create-1.json');
const secondBody = require('./fixtures/comment-create-2.json');
const Matrix = require('../src/matrix/');
const {postStatusData} = require('../src/bot/helper');
const {getPostEpicUpdatesData} = require('../src/queue/parse-body');
const nock = require('nock');

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
        const {data} = getPostEpicUpdatesData(secondBody);
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
});
