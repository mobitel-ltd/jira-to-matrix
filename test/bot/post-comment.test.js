const nock = require('nock');
const assert = require('assert');
const {auth} = require('../../src/lib/utils.js');
const JSONbody = require('../fixtures/comment-create-1.json');
const {getPostCommentData} = require('../../src/jira-hook-parser/parse-body.js');
const {postComment} = require('../../src/bot');
const {getRequestErrorLog} = require('../../src/lib/request.js');
const {BASE_URL} = require('../../src/matrix/timeline-handler/commands/helper.js');
const querystring = require('querystring');

describe('Post comments test', () => {
    const responce = {
        id: '10002',
        self: 'http://www.example.com/jira/rest/api/2/issue/10002',
        key: 'EX-1',
    };
    const sendHtmlMessage = (roomId, body, htmlBody) => {
        assert.equal(roomId, 'roomIdEX-1');
        assert.equal('jira_test добавил(а) комментарий: \n12345', body);
        const expectedHtmlBody = 'jira_test добавил(а) комментарий: <br>12345';

        assert.ok(htmlBody, expectedHtmlBody);
        return true;
    };
    const getRoomId = id => `roomId${id}`;
    const mclient = {sendHtmlMessage, getRoomId};
    const postCommentData = getPostCommentData(JSONbody);
    const params = {expand: 'renderedFields'};
    const errorStatus = 404;

    before(() => {
        nock(BASE_URL, {
            reqheaders: {
                Authorization: auth(),
            },
        })
            .get('/26313')
            .query(params)
            .times(2)
            .reply(200, {...responce, id: 28516})
            .get(url => url.indexOf('null') > 0)
            .reply(errorStatus);
    });


    it('Get links', async () => {
        const result = await postComment({mclient, ...postCommentData});
        assert.ok(result);
    });

    it('Get error with empty issueID', async () => {
        const newBody = {...postCommentData, issueID: null};

        try {
            await postComment({mclient, ...newBody});
        } catch (err) {
            const fakeUrl = `${BASE_URL}/null?${querystring.stringify(params)}`;
            const requestErrorLog = getRequestErrorLog(fakeUrl, errorStatus);
            const expected = [
                'Error in Post comment',
                'getIssueFormatted Error',
                'Error in get issue',
                requestErrorLog,
            ].join('\n');
            assert.deepEqual(err, expected);
        }
    });

    it('Expect postComment throw error "No roomId for" if room is not exists', async () => {
        const mclient = {
            getRoomId: () => null,
        };
        try {
            await postComment({mclient, ...postCommentData});
        } catch (err) {
            assert(err.includes('No roomId for'), true);
        }
    });
});
