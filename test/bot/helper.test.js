const assert = require('assert');
const logger = require('../../src/modules/log.js')(module);
const thirdBody = require('../fixtures/comment-create-3.json');
const {postStatusData} = require('../../src/bot/helper');
const {getPostEpicUpdatesData} = require('../../src/queue/parse-body');

describe('bot func', () => {
    it('postStatusData', () => {
        const {data} = getPostEpicUpdatesData(thirdBody);
        const {body, htmlBody} = postStatusData(data);
        assert.equal(body, 'BBCOM-956 "BBCOM-956" теперь в статусе "Closed"');
        const expected = `<p>jira_test изменил(а) статус связанной задачи <a href="https://jira.bingo-boom.ru/jira/browse/BBCOM-956">BBCOM-956 &quot;BBCOM-956&quot;</a> на <strong>Closed</strong></p>\n`;
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

        logger.debug('data', data);
        const {body, htmlBody} = postStatusData(data);
        assert.equal(body, null);
        assert.equal(htmlBody, null);
    });
});
