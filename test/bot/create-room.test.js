const nock = require('nock');
const assert = require('assert');
const {auth} = require('../../src/jira/common');
const logger = require('../../src/modules/log.js')(module);
const JSONbody = require('../fixtures/comment-create-2.json');
const {getCreateRoomData} = require('../../src/queue/parse-body.js');
const {isCreateRoom} = require('../../src/queue/bot-handler.js');
const {createRoom} = require('../../src/bot');

describe('Create room test', () => {
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
    const roomCreating = options => {
        logger.debug('options', options)
        const expected = {
            room_alias_name: 'BBCOM-956',
            invite: ['@jira_test:matrix.bingo-boom.ru'],
            name: 'BBCOM-956 BBCOM-956',
            topic: 'https://jira.bingo-boom.ru/jira/browse/BBCOM-956'
        };

        assert.deepEqual(options, expected);
        return options.room_alias_name;
    }
    const mclient = {sendHtmlMessage, getRoomId, createRoom: roomCreating};

    const createRoomData = getCreateRoomData(JSONbody);
    logger.debug('createRoomData', createRoomData);

    before(() => {
        nock('https://jira.bingo-boom.ru', {
            reqheaders: {
                Authorization: auth()
            }
            })
            .get('/jira/rest/api/2/issue/BBCOM-956/watchers')
            .reply(200, {...responce, id: 28516})
            .get(url => url.indexOf('null') > 0)
            .reply(404);
    });

    it('Room should not be created', async () => {
        const result = await createRoom({mclient, ...createRoomData});
        assert.ok(result);
    });

    it('Room should be created', async () => {
        const getRoomId = id => null;
        const newMclient = {...mclient, getRoomId}
        const result = await createRoom({mclient: newMclient, ...createRoomData});
        assert.ok(result);
    });

    it('Get error with empty issueID', async () => {
        const newBody = {...createRoomData, issueID: null};
        logger.debug('newBody', newBody);

        try {
            const result = await createRoom({mclient, ...newBody});
        } catch (err) {
            const funcErr = () => {
                throw err
            };
            assert.throws(funcErr, /Error in fetchJSON/);
        }
    });
});
