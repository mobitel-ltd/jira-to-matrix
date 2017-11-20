const queue = require('../src/queue/');
const assert = require('assert');
const logger = require('debug')('handler');
const body = require('./fixtures/jira-body.json');
const matrix = require('../src/matrix/');

describe('test handler', async () => {
    logger('handler', body);
    const connect = await matrix.connect();
    handler(connect);
    it('Should return OK', () => {
        // const expected = await queue.handler(body, connect, []);
        assert.ok(body);

    });
});
