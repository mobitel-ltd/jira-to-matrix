const nock = require('nock');
const assert = require('assert');
const {auth} = require('../../src/jira/common');
const logger = require('../../src/modules/log.js')(module);
const JSONbody = require('../fixtures/comment-create-1.json');
const {getPostCommentData} = require('../../src/queue/parse-body.js');
const {postComment} = require('../../src/bot');
const {isPostNewLinks} = require('../../src/queue/bot-handler.js');
const redis = require('../../src/redis-client.js');
const {redis: {prefix}} = require('../fixtures/config.js');

describe('Post comments test', () => {
    const responce = {
        id: "10002",
        self: "http://www.example.com/jira/rest/api/2/issue/10002",
        key: "EX-1"
    };
    const sendHtmlMessage = (roomId, body, htmlBody) => {
        assert.equal(roomId, 'roomIdEX-1');
        assert.equal('jira_test добавил(а) комментарий: \n12345', body);
        logger.debug('htmlBody', htmlBody);
        const expectedHtmlBody = 'jira_test добавил(а) комментарий: <br>12345';

        assert.ok(htmlBody, expectedHtmlBody);
        return true;
    };
    const getRoomId = id => `roomId${id}`;
    const mclient = {sendHtmlMessage, getRoomId};
    const postCommentData = getPostCommentData(JSONbody);
    logger.debug('postCommentData', postCommentData);

    before(() => {
        nock('https://jira.bingo-boom.ru', {
            reqheaders: {
                Authorization: auth()
            }
            })
            .get('/jira/rest/api/2/issue/26313')
            .query({expand: 'renderedFields'})
            .reply(200, {...responce, id: 28516})
            .get(url => url.indexOf('null') > 0)
            .reply(404);
    });


    it('Get links', async () => {
        const result = await postComment({mclient, ...postCommentData});
        assert.ok(result);
    });

    it('Get error with empty issueID', async () => {
        const newBody = {...postCommentData, issueID: null};
        logger.debug('newBody', newBody);

        try {
            const result = await postComment({mclient, ...newBody});
        } catch (err) {
            const expected = [
                'Error in Post comment',
                'getIssueFormatted Error',
                'Error in get issue',
                'Error in fetchJSON https://jira.bingo-boom.ru/jira/rest/api/2/issue/null?expand=renderedFields',
                'FetchError: invalid json response body at https://jira.bingo-boom.ru/jira/rest/api/2/issue/null?expand=renderedFields reason: Unexpected end of JSON input',
            ].join('\n');
            assert.deepEqual(err, expected);
        }
    });
});
