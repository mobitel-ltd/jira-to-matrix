const getBotFunc = require('../src/queue/bot-handler');
const assert = require('assert');
const logger = require('debug')('test-bot-func');
const firstBody = require('./fixtures/comment-create-1.json');
const {postComment} = require('../src/bot/post-comment');
const bot = require('../src/bot');
const matrixApi = require('../src/matrix/');

describe('bot func', function() {
    this.timeout(15000);

    it('test correct JSON', () => {
        const result = typeof firstBody;
        logger('result', result);
        assert.equal(result, 'object');
    });

    it('test correct funcs ', () => {
        const result = getBotFunc(firstBody);
        logger('result', result);
        const expected = ['postComment'];
        assert.deepEqual(result, expected);
    });

    it('async arr expect', () => {
        const funcsForBot = getBotFunc(firstBody);
        logger('funcsForBot', Array.isArray(funcsForBot));
        const result = funcsForBot.map(func => bot[func]);
        assert.ok(Array.isArray(result));
    });

    it('postComment', async () => {
        const {connect, disconnect, helpers} = matrixApi;
        // const initconf = await init(config.matrix);
        // logger('connect', connect);
        // logger('init', initconf);
        const mclient = await connect();
        const req = {mclient, body: firstBody};
        const result = await postComment(req);
        assert.ok(result);
        await disconnect();
    })
});
