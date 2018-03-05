const nock = require('nock');
const assert = require('assert');
const {auth} = require('../../src/jira/common');
const logger = require('../../src/modules/log.js')(module);
// const body = require('../fixtures/comment-create-4.json');
const {BASE_URL} = require('../../src/matrix/timeline-handler/commands/helper.js');
const {schemaMove} = require('../../src/matrix/timeline-handler/commands/schemas.js');
const {move} = require('../../src/matrix/timeline-handler/commands');
const responce = require('../fixtures/transitions.json');

describe('move test', () => {
    const sendHtmlMessage = (roomId, body, htmlBody) => {
        logger.debug('body', body);
        logger.debug('htmlBody', htmlBody);
        assert.equal(body, 'list commands');
        assert.equal(htmlBody, '<b>Список доступных команд:</b><br>&nbsp;&nbsp;1)&nbsp;Close Issue<br>&nbsp;&nbsp;2)&nbsp;QA Review<br>');

        return true;
    };
    const matrixClient = {sendHtmlMessage};
    const roomName = 'BBCOM-123';
    const room = {id: 12345};

    before(() => {
        nock(BASE_URL, {
            reqheaders: {
                Authorization: auth(),
            },
        })
            .get(`/fake/transitions`)
            .reply(404)
            .get(`/${roomName}/transitions`)
            .times(2)
            .reply(200, responce)
            .post(`/${roomName}/transitions`, schemaMove('2'))
            .reply(204)
            .post(`/${roomName}/transitions`, schemaMove('5'))
            .reply(400);
    });

    it('Get correct !move list commands', async () => {
        const result = await move({bodyText: '', room, roomName, matrixClient});
        logger.debug('move', result);
    });

    it('Get correct !move command', async () => {
        const result = await move({bodyText: '1', room, roomName, matrixClient});
        logger.debug('move', result);

        const expected = `Issue ${roomName} changed status`;
        assert.equal(result, expected);
    });

    it('Get error', async () => {
        try {
            await move({bodyText: '1', room, roomName: 'fake', matrixClient});
        } catch (err) {
            const expected = 'Error in fetchJSON';
            assert.equal(err, expected);
        }
    });
});
