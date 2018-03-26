const nock = require('nock');
const assert = require('assert');
const {expect} = require('chai');
const {auth} = require('../../src/jira/common');
const JSONbody = require('../fixtures/create.json');
const {getCreateRoomData} = require('../../src/queue/parse-body.js');
const {isCreateRoom} = require('../../src/queue/bot-handler.js');
const {createRoom} = require('../../src/bot');
const issueBody = require('../fixtures/response.json');

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
        assert.equal(roomId, 'roomIdBBCOM-801');
        assert.equal('Новая задача в эпике', body);
        const expectedHtmlBody = '<p>К эпику добавлена задача <a href="https://jira.bingo-boom.ru/jira/browse/BBCOM-956">BBCOM-956 BBCOM-956</a></p>\n';

        assert.equal(htmlBody, expectedHtmlBody);
        return true;
    };
    const getRoomId = id => `roomId${id}`;
    const roomCreating = options => {
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

    const createRoomData = getCreateRoomData(JSONbody);

    before(() => {
        nock('https://jira.bingo-boom.ru', {
            reqheaders: {
                Authorization: auth()
            }
            })
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
        const result = await createRoom({mclient, ...createRoomData});
        assert.ok(result);
    });

    it('Room should be created', async () => {
        // No room - roomId is null
        const sendHtmlMessage = (roomId, body, htmlBody) => {
            assert.equal(roomId, 'BBCOM-1398');
            const formattedBody = body.split('\n').filter(Boolean).join('');
            const formattedhtmlBody = htmlBody.split('\n').filter(Boolean).map(el => el.trim()).join('');
            const expectedBody = [
                'Assignee: jira_test jira_test@bingo-boom.ruReporter: jira_test jira_test@bingo-boom.ruType: TaskEstimate time: 1hDescription: InfoPriority: MediumEpic link: undefined (BBCOM-801) https://jira.bingo-boom.ru/jira/browse/BBCOM-801',
                'Send tutorial'
            ];
            'Epic link:<br>&nbsp;&nbsp;&nbsp;&nbsp;undefined (BBCOM-801)<br>&nbsp;&nbsp;&nbsp;&nbsp;\thttps://jira.bingo-boom.ru/jira/browse/BBCOM-801<br>'
            expect(formattedBody).to.be.oneOf(expectedBody);
            const infoBody = [
                'Assignee:<br>&nbsp;&nbsp;&nbsp;&nbsp;jira_test<br>&nbsp;&nbsp;&nbsp;&nbsp;jira_test@bingo-boom.ru<br><br>',
                'Reporter:<br>&nbsp;&nbsp;&nbsp;&nbsp;jira_test<br>&nbsp;&nbsp;&nbsp;&nbsp;jira_test@bingo-boom.ru<br><br>',
                'Type:<br>&nbsp;&nbsp;&nbsp;&nbsp;Task<br><br>',
                'Estimate time:<br>&nbsp;&nbsp;&nbsp;&nbsp;1h<br><br>',
                'Description:<br>&nbsp;&nbsp;&nbsp;&nbsp;Info<br><br>',
                'Priority:<br>&nbsp;&nbsp;&nbsp;&nbsp;Medium<br><br>',
                'Epic link:<br>&nbsp;&nbsp;&nbsp;&nbsp;undefined (BBCOM-801)<br>&nbsp;&nbsp;&nbsp;&nbsp;\thttps://jira.bingo-boom.ru/jira/browse/BBCOM-801<br>',
            ];
            const expectedHtmlBody = [
                infoBody.join(''),
                '<br>Use <font color="green"><strong>!help</strong></font> in chat for give info for jira commands',
            ];
            // infoBody.forEach(item => expect(formattedhtmlBody).to.include(item));
            // expectedHtmlBody.forEach(item => expect(formattedhtmlBody).to.equal(item));
            expect(expectedHtmlBody).to.include(formattedhtmlBody);
            return true;
        };

        const getRoomId = id => null;
        const newMclient = {...mclient, getRoomId, sendHtmlMessage}
        const result = await createRoom({mclient: newMclient, ...createRoomData});
        assert.ok(result);
    });

    it('Get error with empty issueID', async () => {
        const newBody = {...createRoomData, issueID: null};

        try {
            const result = await createRoom({mclient, ...newBody});
        } catch (err) {
            assert.deepEqual(err, '');
        }
    });
});
