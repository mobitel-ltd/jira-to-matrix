const {getBotFunc} = require('../src/queue/bot-handler');
const assert = require('assert');
const logger = require('../src/modules/log.js')(module);
const firstBody = require('./fixtures/comment-create-1.json');
const secondBody = require('./fixtures/comment-create-2.json');
const Matrix = require('../src/matrix/');

describe('bot func', function() {
    this.timeout(15000);

    it('error sendHtmlMessage', async () => {
        try {
            const mclient = await Matrix.connect();
            await mclient.sendHtmlMessage(null);
        } catch (err) {
            logger.debug('error', err);
            assert.ok(err);
            Matrix.disconnect();
        }
    });
});
