const assert = require('assert');
const logger = require('debug')('test JIRA');
const allUsers = require('../src/utils/get-all-from-jira');

describe('Jira max 1000', function() {
    it('test mar jira', async () => {
        const result = await allUsers();
        logger('result', result.length);
        assert.ok(allUsers);
    });
});
