const assert = require('assert');
const logger = require('../../src/modules/log.js')(module);
const body = require('../fixtures/comment-create-4.json');
const {getPostNewLinksData} = require('../../src/queue/parse-body.js');
const postNewLinks = require('../../src/bot/post-new-links.js');
const Matrix = require('../../src/matrix');

describe('post New Links test', function() {
    this.timeout(15000);
    let mclient;

    before(async () => {
        mclient = await Matrix.connect();
    })
    
    it('Get links', async () => {
        const {links} = getPostNewLinksData(body);
        logger.debug('postNewLinksData', links);

        const result = await postNewLinks({mclient, links});
        assert.ok(result);
    });
});
