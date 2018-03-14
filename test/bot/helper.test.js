const assert = require('assert');
const logger = require('../../src/modules/log.js')(module);
const thirdBody = require('../fixtures/comment-create-3.json');
const secondBody = require('../fixtures/comment-create-2.json');
const {
    membersInvited,
    postStatusData,
    getNewStatus,
    getEpicChangedMessageBody,
    getNewEpicMessageBody,
    getNewIssueMessageBody,
    fieldNames,
    itemsToString,
    composeText,
    getUserID,
} = require('../../src/bot/helper');
const {getPostEpicUpdatesData} = require('../../src/queue/parse-body');
const {getPostProjectUpdatesData} = require('../../src/queue/parse-body');

const {expect} = require('chai');

describe('Helper tests', () => {
    it('getEpicChangedMessageBody', () => {
        const {data} = getPostProjectUpdatesData(secondBody);

        const {body, htmlBody} = getEpicChangedMessageBody(data);

        assert.equal(body, 'Эпик изменён');

        const expected = `<p>${data.name} изменил(а) статус связанного эпика <a href="https://jira.bingo-boom.ru/jira/browse/BBCOM-956">${data.key} &quot;${data.summary}&quot;</a> на <strong>${data.status}</strong></p>\n`;
        assert.equal(htmlBody, expected);
    });

    it('getNewEpicMessageBody', () => {
        const {data} = getPostProjectUpdatesData(secondBody);
        logger.debug('getPostProjectUpdatesData', data);

        const {body, htmlBody} = getNewEpicMessageBody(data);

        assert.equal(body, 'Новый эпик в проекте');

        const expected = `<p>К проекту добавлен эпик <a href="https://jira.bingo-boom.ru/jira/browse/BBCOM-956">${data.key} ${data.summary}</a></p>\n`;
        assert.equal(htmlBody, expected);
    });

    it('getNewStatus', () => {
        const status = getNewStatus(thirdBody);
        assert.equal(status, 'Closed');
    });

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
        assert.equal(htmlBody, '<p>К эпику добавлена задача <a href="https://jira.bingo-boom.ru/jira/browse/BBCOM-956">BBCOM-956 lalalla</a></p>\n');
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

        expect(result).to.equal('@BBCOM:matrix.bingo-boom.ru');
    });
});
