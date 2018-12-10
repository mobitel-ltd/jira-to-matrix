const {getBotActions} = require('../../src/jira-hook-parser/bot-handler');
const assert = require('assert');
const firstBody = require('../fixtures/comment-create-1.json');
const secondBody = require('../fixtures/comment-create-2.json');
const bot = require('../../src/bot');

describe('bot func', () => {
    it('test correct JSON', () => {
        const result = typeof firstBody;
        assert.equal(result, 'object');
    });

    it('test correct funcs ', () => {
        const result = getBotActions(firstBody);
        const expected = ['postComment'];
        assert.deepEqual(result, expected);
    });

    it('test correct funcs seconBody', () => {
        const result = getBotActions(secondBody);
        const expected = [
            'inviteNewMembers',
            'postEpicUpdates',
        ];
        assert.deepEqual(result, expected);
    });

    it('async arr expect', () => {
        const funcsForBot = getBotActions(firstBody);
        const result = funcsForBot.map(func => bot[func]);
        assert.ok(Array.isArray(result));
    });
});
