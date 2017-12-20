const {isCreateRoom} = require('../src/queue/bot-handler.js');
const assert = require('assert');

describe('Dif funcs testing', function() {
    it('isCreateRoom for null', () => {
        const result = isCreateRoom(null);
        assert.equal(result, false);
    });

    it('isCreateRoom for body', () => {
        const result = isCreateRoom(null);
        const body = {
            "timestamp": 1512034084304,
            "webhookEvent": "comment_created",
            "comment": {
                "self": "https://jira.bingo-boom.ru/jira/rest/api/2/issue/26313/comment/31039",
                "id": "31039",
        
            }
        };
        assert.equal(result, false);
    });
});
