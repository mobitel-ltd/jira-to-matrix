const assert = require('assert');
// const logger = require('../../src/modules/log.js')(module);
const {getNewIssueMessageBody} = require('../../src/bot/post-epic-updates');

describe('bot func', () => {
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
        assert.equal(htmlBody, '<p>К эпику добавлена задача <a href="https://jira.bingo-boom.ru/jira/browse/BBCOM-956">BBCOM-956 lalalla</a></p>\n');
    });
});
