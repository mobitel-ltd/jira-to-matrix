const nock = require('nock');
const assert = require('assert');
const {auth} = require('../../src/jira/common');
const JSONbody = require('../fixtures/comment-create-4.json');
const {getPostProjectUpdatesData} = require('../../src/queue/parse-body.js');
const {isPostProjectUpdates} = require('../../src/queue/bot-handler.js');
const redis = require('../../src/redis-client.js');
const {redis: {prefix}} = require('../fixtures/config.js');
const {postProjectUpdates} = require('../../src/bot');


describe('Post project updates test', () => {
    const responce = {
        id: "10002",
        self: "http://www.example.com/jira/rest/api/2/issue/10002",
        key: "EX-1",
        fields: {
            summary: 'SummaryKey',
        }
    };

    const sendHtmlMessage = (roomId, body, htmlBody) => {
        assert.equal(roomId, 'roomIdBBCOM');
        assert.equal('Эпик изменён', body);
        const expectedHtmlBody = '<p>jira_test изменил(а) статус связанного эпика <a href="https://jira.bingo-boom.ru/jira/browse/BBCOM-1233">BBCOM-1233 &quot;POupok&quot;</a> на <strong>Paused</strong></p>\n';

        assert.equal(htmlBody, expectedHtmlBody);
        return true;
    };
    const getRoomId = id => `roomId${id}`;
    const mclient = {sendHtmlMessage, getRoomId};

    const postProjectUpdatesData = getPostProjectUpdatesData(JSONbody);

    before(() => {
        const {epicKey} = postProjectUpdatesData;
        nock('https://jira.bingo-boom.ru', {
            reqheaders: {
                Authorization: auth()
            }
            })
            .get(`/jira/rest/api/2/issue/BBCOM-801`)
            .reply(200, {...responce, id: 28516});
    });

    it('getPostProjectUpdatesData', () => {
        const result = isPostProjectUpdates(JSONbody);
        assert.ok(result);
    });

    it('postProjectUpdates', async () => {
        const result = await postProjectUpdates({mclient, ...postProjectUpdatesData});
        assert.ok(result);
    });
});
