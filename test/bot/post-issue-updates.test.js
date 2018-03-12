const nock = require('nock');
const chai = require('chai');
const assert = require('assert');
const {auth} = require('../../src/jira/common');
const logger = require('../../src/modules/log.js')(module);
const JSONbody = require('../fixtures/comment-create-4.json');
const {getPostIssueUpdatesData} = require('../../src/queue/parse-body.js');
const {isPostIssueUpdates} = require('../../src/queue/bot-handler.js');
const {postIssueUpdates} = require('../../src/bot');
const response = require('../fixtures/response.json');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('Post issue updates test', () => {
    const sendHtmlMessageStub = stub().callsFake((roomId, body, htmlBody) => {});
    const setRoomNameStub = stub().callsFake((oldName, newName) => {
        if (!oldName) {
            throw 'No Old name';
        }
    });
    const getRoomIdStub = stub().callsFake(id => id ? `roomId${id}` : null);
    const createAliasStub = stub();
    const setRoomTopicStub = stub();

    const mclient = {
        sendHtmlMessage: sendHtmlMessageStub,
        getRoomId: getRoomIdStub,
        setRoomName: setRoomNameStub,
        createAlias: createAliasStub,
        setRoomTopic: setRoomTopicStub,
    };

    const postIssueUpdatesData = getPostIssueUpdatesData(JSONbody);

    before(() => {
        const {epicKey} = postIssueUpdatesData;
        nock('https://jira.bingo-boom.ru', {
            reqheaders: {
                Authorization: auth()
            }
            })
            .get(`/jira/rest/api/2/issue/BBCOM-1233`)
            .times(2)
            .query({expand: 'renderedFields'})
            .reply(200, {...response, id: 28516})
            .get(url => url.indexOf('null') > 0)
            .reply(404);
    });
    it('Expect createAlias to be with error but postIssueUpdates should work', async () => {
        createAliasStub.callsFake((alias, roomId) => {
            try {
                throw new Error('M_UNKNOWN: Room alias #BAO-193:matrix.bingo-boom.ru already exists');
            } catch (err) {
                logger.error(err);
                if (err.message.includes(`Room alias #BAO-193:matrix.bingo-boom.ru already exists`)) {
                    logger.warn(err.message);

                    return null;
                }
                throw ['Error while creating alias for a room', err].join('\n');
            }
        });

        // createAliasStub.throws('M_UNKNOWN: Room alias #BAO-193:matrix.bingo-boom.ru already exists');
        try {
            const result = await postIssueUpdates({mclient, ...postIssueUpdatesData});
            expect(sendHtmlMessageStub).have.to.been.calledWithExactly(
                'roomIdRN-83',
                'Задача изменена',
                'jira_test изменил(а) задачу<br>status: Paused<br>description: <p>Задача</p><br>Key: BAO-193'
            );
            expect(result).to.be.true;
        } catch (error) {
            logger.error(error)
            expect(error).to.be.null;
        }
        createAliasStub.reset();
    });

    it('Is correct postIssueUpdatesData', async () => {
        createAliasStub.callsFake((fieldKey, roomID) => {});

        const result = await postIssueUpdates({mclient, ...postIssueUpdatesData});
        expect(sendHtmlMessageStub).have.to.been.calledWithExactly(
            'roomIdRN-83',
            'Задача изменена',
            'jira_test изменил(а) задачу<br>status: Paused<br>description: <p>Задача</p><br>Key: BAO-193'
        );
        expect(result).to.be.true;
    });



    it('test isPostIssueUpdates', async () => {
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
