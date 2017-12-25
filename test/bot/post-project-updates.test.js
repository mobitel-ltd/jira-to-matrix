const assert = require('assert');
const logger = require('../../src/modules/log.js')(module);
const secondBody = require('../fixtures/comment-create-2.json');
const {getEpicChangedMessageBody, getNewEpicMessageBody} = require('../../src/bot/post-project-updates');
const {getPostProjectUpdatesData} = require('../../src/queue/parse-body');

describe('bot func', function() {
    it('getEpicChangedMessageBody', async () => {
        const {data} = getPostProjectUpdatesData(secondBody);

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
