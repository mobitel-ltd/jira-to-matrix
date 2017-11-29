const assert = require('assert');
const logger = require('debug')('test JIRA');
const {searchUser, getAllUsers, BASE_URL} = require('../src/matrix/timeline-handler/commands/helper');

describe('Search users', function() {
    this.timeout(15000);
    
    it('test max 1000 jira', async () => {
        const result = await getAllUsers();
        logger('result', result.length);
        assert.ok(result);
    });

    it('test get Users by part of name', async () => {
        const result = await searchUser('Макар');
        logger('result', result);
        assert.equal(result.length, 4);
    });

    it('test BASE_URL', () => {
        const expected = 'https://jira.bingo-boom.ru/jira/rest/api/2/issue';
        assert.equal(BASE_URL, expected);
        const notExpected = 'https://jira.bingo-boom.ru/jira/rest/api/2/search';
        assert.notEqual(BASE_URL, notExpected);
    })
});
