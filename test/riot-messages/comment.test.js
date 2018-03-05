const nock = require('nock');
const assert = require('assert');
const {auth} = require('../../src/jira/common');
const logger = require('../../src/modules/log.js')(module);
// const body = require('../fixtures/comment-create-4.json');
const {BASE_URL} = require('../../src/matrix/timeline-handler/commands/helper.js');
const {schemaComment} = require('../../src/matrix/timeline-handler/commands/schemas.js');
const {comment} = require('../../src/matrix/timeline-handler/commands');

describe('comment test', () => {
    const sendHtmlMessage = (roomId, body, htmlBody) => {
        logger.debug('body', body);
        logger.debug('htmlBody', htmlBody);
        assert.equal(body, 'Что-то пошло не так! Комментарий не опубликован');
        assert.equal(htmlBody, 'Что-то пошло не так! Комментарий не опубликован');

        return true;
    };
    const matrixClient = {sendHtmlMessage};
    const roomName = 'BBCOM-123';
    const bodyText = 'text in body';
    const sender = 'Bot';

    before(() => {
        nock(BASE_URL, {
            reqheaders: {
                Authorization: auth(),
            },
        })
            .post(`/${roomName}/comment`, schemaComment(sender, bodyText))
            .reply(201)
            .post(`/${roomName}/comment`)
            .reply(400);
    });


    it('should comment', async () => {
        const room = {id: 12345};

        const result = await comment({bodyText, sender, room, roomName, matrixClient});
        logger.debug('comment', result);

        const expected = `Comment from ${sender} for ${roomName}`;
        assert.equal(result, expected);
    });

    it('comment not published', async () => {
        const room = {id: 12345};

        const commentAnswer = await comment({bodyText, sender: null, room, roomName, matrixClient});
        const result = commentAnswer.replace(/(\r\n|\n|\r)/gm, '').trim();
        logger.debug('comment', result);

        const expected = `Comment from null for ${roomName} not published                Jira have status 400`;
        assert.equal(result, expected);
    });
});
