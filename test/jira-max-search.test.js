const assert = require('assert');
const logger = require('debug')('test JIRA');
const allUsers = require('../src/utils/get-all-from-jira');
const {searchUser} = require('../src/matrix/timeline-handler/commands/helper');

describe('Search users', function() {
    this.timeout(15000);
    
    it('test max 1000 jira', async () => {
        const result = await allUsers();
        logger('result', result.length);
        assert.ok(result);
    });

    it('test get Users by part of name', async () => {
        const result = await searchUser('Макар');
        logger('result', result);
        assert.equal(result.length, 4);
    });
});
