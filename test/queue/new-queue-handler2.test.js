const nock = require('nock');
const assert = require('assert');
const {expect} = require('chai');
const {auth} = require('../../src/jira/common');
const logger = require('../../src/modules/log.js')(module);
const JSONbody = require('../fixtures/create.json');
const issueBody = require('../fixtures/response.json');
const getParsedAndSaveToRedis = require('../../src/queue/get-parsed-and-save-to-redis.js');
const {getRedisKeys, getDataFromRedis, getRedisRooms, handleRedisData, handleRedisRooms} = require('../../src/queue/redis-data-handle.js');
const {prefix} = require('../fixtures/config.js').redis;
const redis = require('../../src/redis-client.js');

describe('Create room test', () => {
    const responce = {
        id: "10002",
        self: "http://www.example.com/jira/rest/api/2/issue/10002",
        key: "EpicKey",
        fields: {
            summary: 'SummaryKey',
        }
    };

    const epicResponse = {
        id: "10002",
        self: "http://www.example.com/jira/rest/api/2/issue/1000122",
        key: "EX-1",
        fields: {
            summary: 'SummaryKey',
        }
    };
    const sendHtmlMessage = (roomId, body, htmlBody) => {
        assert.equal(roomId, 'BBCOM-1398');
        const formattedBody = body.split('\n').filter(Boolean).join('');
        const formattedhtmlBody = htmlBody.split('\n').filter(Boolean).map(el => el.trim()).join('');
        logger.debug('body', formattedBody);
        logger.debug('htmlBody', formattedhtmlBody);
        const expectedBody = [
            'Assignee: jira_test jira_test@bingo-boom.ruReporter: jira_test jira_test@bingo-boom.ruType: TaskEpic link: undefined (BBCOM-801) https://jira.bingo-boom.ru/jira/browse/BBCOM-801Estimate time: 1hDescription: Info',
            'Send tutorial'
        ];

        expect(expectedBody).to.include(formattedBody);
        const expectedHtmlBody = [
            'Assignee:<br>&nbsp;&nbsp;&nbsp;&nbsp;jira_test<br>&nbsp;&nbsp;&nbsp;&nbsp;jira_test@bingo-boom.ru<br><br>Reporter:<br>&nbsp;&nbsp;&nbsp;&nbsp;jira_test<br>&nbsp;&nbsp;&nbsp;&nbsp;jira_test@bingo-boom.ru<br><br>Type:<br>&nbsp;&nbsp;&nbsp;&nbsp;Task<br><br>Epic link:<br>&nbsp;&nbsp;&nbsp;&nbsp;undefined (BBCOM-801)<br>&nbsp;&nbsp;&nbsp;&nbsp;	https://jira.bingo-boom.ru/jira/browse/BBCOM-801<br><br>Estimate time:<br>&nbsp;&nbsp;&nbsp;&nbsp;1h<br><br>Description:<br>&nbsp;&nbsp;&nbsp;&nbsp;Info<br>',
            '<br>Use <font color="green"><strong>!help</strong></font> in chat for give info for jira commands',
        ];

        expect(expectedHtmlBody).to.include(formattedhtmlBody);
        return true;
    };
    const getRoomId = id => null;
    const roomCreating = options => {
        logger.debug('options', options)
        const expected = {
            room_alias_name: 'BBCOM-1398',
            invite: ['@jira_test:matrix.bingo-boom.ru'],
            name: 'BBCOM-1398 Test',
            topic: 'https://jira.bingo-boom.ru/jira/browse/BBCOM-1398'
        };

        assert.deepEqual(options, expected);
        return options.room_alias_name;
    }
    const mclient = {sendHtmlMessage, getRoomId, createRoom: roomCreating};

    before(() => {
        nock('https://jira.bingo-boom.ru', {reqheaders: {Authorization: auth()}})
            .get('/jira/rest/api/2/issue/BBCOM-1398/watchers')
            .reply(200, {...responce, id: 28516})
            .get(`/jira/rest/api/2/issue/30369?expand=renderedFields`)
            .reply(200, issueBody)
            .get(`/jira/rest/api/2/issue/BBCOM-801?expand=renderedFields`)
            .reply(200, issueBody)
            .get(url => url.indexOf('null') > 0)
            .reply(404);
        });

    it('Room should not be created', async () => {
        await getParsedAndSaveToRedis(JSONbody);
        const roomsKeys = await getRedisRooms();
        await handleRedisRooms(mclient, roomsKeys);

        const newRoomsKeys = await getRedisRooms();
        assert.equal(newRoomsKeys, null);
    });

    after(async () => {
        const keys = await redis.keysAsync('*');

        if (keys.length > 0) {
            const parsedKeys = keys.map(key => key.replace(`${prefix}`, ''));
            await redis.delAsync(parsedKeys);
        }
    });
});
