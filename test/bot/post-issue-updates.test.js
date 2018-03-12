const nock = require('nock');
const assert = require('assert');
const {auth} = require('../../src/jira/common');
const logger = require('../../src/modules/log.js')(module);
const JSONbody = require('../fixtures/comment-create-4.json');
const {getPostIssueUpdatesData} = require('../../src/queue/parse-body.js');
const {isPostIssueUpdates} = require('../../src/queue/bot-handler.js');
const {postIssueUpdates} = require('../../src/bot');
const response = require('../fixtures/response.json');

describe('Post issue updates test', () => {
    const sendHtmlMessage = (roomId, body, htmlBody) => {
        assert.equal(roomId, 'roomIdBBCOM-1233');
        assert.equal('Задача изменена', body);
        logger.debug('htmlBody', htmlBody);
        const expectedHtmlBody = 'jira_test изменил(а) задачу<br>status: Paused';
        assert.equal(htmlBody, expectedHtmlBody);
        return true;
    };

    const getRoomId = id => id ? `roomId${id}` : null;

    const setRoomName = (oldName, newName) => {
        if (!oldName) {
            throw 'No Old name';
        }
        logger.debug(`New name of ${oldName} is ${newName}`);
    }

    const mclient = {sendHtmlMessage, getRoomId, setRoomName};

    const postIssueUpdatesData = getPostIssueUpdatesData(JSONbody);
    logger.debug('postIssueUpdatesData', postIssueUpdatesData);

    before(() => {
        const {epicKey} = postIssueUpdatesData;
        nock('https://jira.bingo-boom.ru', {
            reqheaders: {
                Authorization: auth()
            }
            })
            .get(`/jira/rest/api/2/issue/BBCOM-1233`)
            .query({expand: 'renderedFields'})
            .reply(200, {...response, id: 28516})
            .get(url => url.indexOf('null') > 0)
            .reply(404);
    });

    it('Is correct postIssueUpdatesData', async () => {
        const result = await postIssueUpdates({mclient, ...postIssueUpdatesData});
        assert.ok(result);
    });

    it('Get links', async () => {
        const result = isPostIssueUpdates(JSONbody);
        assert.ok(result);
    });

    it('Get error with empty issueID', async () => {
        const newBody = {...postIssueUpdatesData, issueKey: null};
        logger.debug('newBody', newBody);

        try {
            const result = await postIssueUpdates({mclient, ...newBody});
        } catch (err) {
            const expected = [
                'Error in postIssueUpdates',
                'No Old name',
            ].join('\n');

            assert.deepEqual(err, expected);
        }
    });
});
