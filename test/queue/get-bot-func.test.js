const {getBotFunc} = require('../../src/queue/bot-handler');
const assert = require('assert');
const logger = require('../../src/modules/log.js')(module);
const firstBody = require('../fixtures/comment-create-1.json');
const secondBody = require('../fixtures/comment-create-2.json');
const bot = require('../../src/bot');

describe('bot func', () => {
    it('test correct JSON', () => {
        const result = typeof firstBody;
        logger.debug('result', result);
        assert.equal(result, 'object');
    });

    it('test correct funcs ', () => {
        const result = getBotFunc(firstBody);
        logger.debug('result', result);
        const expected = ['postComment'];
        assert.deepEqual(result, expected);
    });

    it('test correct funcs seconBody', () => {
        const result = getBotFunc(secondBody);
        logger.debug('result', result);
        const expected = [
            'inviteNewMembers',
            'postEpicUpdates',
        ];
        assert.deepEqual(result, expected);
    });

    it('async arr expect', () => {
        const funcsForBot = getBotFunc(firstBody);
        logger.debug('funcsForBot', Array.isArray(funcsForBot));
        const result = funcsForBot.map(func => bot[func]);
        assert.ok(Array.isArray(result));
    });
});
