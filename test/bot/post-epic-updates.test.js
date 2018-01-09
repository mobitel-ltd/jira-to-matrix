const nock = require('nock');
const assert = require('assert');
const {auth} = require('../../src/jira/common');
const logger = require('../../src/modules/log.js')(module);
const JSONbody = require('../fixtures/comment-create-2.json');
const {getPostEpicUpdatesData} = require('../../src/queue/parse-body.js');
const {isPostEpicUpdates} = require('../../src/queue/bot-handler.js');
const redis = require('../../src/redis-client.js');
const {redis: {prefix}} = require('../fixtures/config.js');
const {getNewIssueMessageBody, postEpicUpdates} = require('../../src/bot/post-epic-updates');

describe('Post epic updates test', () => {
    const responce = {
        id: "10002",
        self: "http://www.example.com/jira/rest/api/2/issue/10002",
        key: "EX-1",
        fields: {
            summary: 'SummaryKey',
        }
    };

    const sendHtmlMessage = (roomId, body, htmlBody) => {
        assert.equal(roomId, 'roomIdBBCOM-801');
        assert.equal('Новая задача в эпике', body);
        logger.debug('htmlBody', htmlBody);
        const expectedHtmlBody = '<p>К эпику добавлена задача <a href="https://jira.bingo-boom.ru/jira/browse/BBCOM-956">BBCOM-956 BBCOM-956</a></p>\n';

        assert.equal(htmlBody, expectedHtmlBody);
        return true;
    };
    const getRoomId = id => `roomId${id}`;
    const mclient = {sendHtmlMessage, getRoomId};

    const postCommentData = getPostEpicUpdatesData(JSONbody);
    logger.debug('postCommentData', postCommentData);

    before(() => {
        const {epicKey} = postCommentData;
        nock('https://jira.bingo-boom.ru', {
            reqheaders: {
                Authorization: auth()
            }
            })
            .get(`/jira/rest/api/2/issue/BBCOM-801`)
            .reply(200, {...responce, id: 28516})
            .get(url => url.indexOf('null') > 0)
            .reply(404);
    });

    it('getNewIssueMessageBody', () => {
        const data = {
            key: 'BBCOM-956',
            summary: 'lalalla',
            id: '26313',
            changelog: null,
            name: 'jira_test',
        };

        const {body, htmlBody} = getNewIssueMessageBody(data);
        assert.equal(body, 'Новая задача в эпике');
        assert.equal(htmlBody, '<p>К эпику добавлена задача <a href="https://jira.bingo-boom.ru/jira/browse/BBCOM-956">BBCOM-956 lalalla</a></p>\n');
    });

    it('Get links', async () => {
        const result = await postEpicUpdates({mclient, ...postCommentData});
        assert.ok(result);
    });

    it('Get error with empty issueID', async () => {
        const newBody = {...postCommentData, issueID: null};
        logger.debug('newBody', newBody);

        try {
            const result = await postEpicUpdates({mclient, ...newBody});
        } catch (err) {
            const funcErr = () => {
                throw err
            };
            assert.throws(funcErr, /Error in fetchJSON/);
        }
    });

    after(async () => {
        const keys = await redis.keysAsync('*');
        logger.debug('keys', keys);
        logger.debug('prefix', prefix);


        if (keys.length > 0) {
            const parsedKeys = keys.map(key => key.replace(`${prefix}`, ''));
            logger.debug('parsedKeys', parsedKeys);
            await redis.delAsync(parsedKeys);
        }
    });
});
