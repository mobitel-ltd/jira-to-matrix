const {shouldCreateRoom} = require('../src/queue/bot-handler.js');
const assert = require('assert');

describe('Dif funcs testing', function() {
    it('shouldCreateRoom for null', () => {
        const result = shouldCreateRoom(null);
        assert.equal(result, false);
    });

    it('shouldCreateRoom for body', () => {
        const result = shouldCreateRoom(null);
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
