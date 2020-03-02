const fs = require('fs');
const path = require('path');
const { getUserIdByDisplayName } = require('../test-utils');
const nock = require('nock');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);
const translate = require('../../src/locales');
const testUtils = require('../test-utils');
const issueJSON = require('../fixtures/jira-api-requests/issue.json');
const { getHTMLtext, getMDtext } = require('../../src/bot/timeline-handler/commands/archive');

const commandHandler = require('../../src/bot/timeline-handler');
const utils = require('../../src/lib/utils');
const messagesJSON = require('../fixtures/archiveRoom/allMessagesFromRoom.json');
const messagesMD = fs.readFileSync(path.resolve(__dirname, '../fixtures/archiveRoom/allMessagesFromRoom.md'), 'utf8');
const messagesHTML = fs.readFileSync(
    path.resolve(__dirname, '../fixtures/archiveRoom/allMessagesFromRoom.html'),
    'utf8',
);

describe('Archive command', () => {
    let chatApi;
    const roomName = issueJSON.key;
    const sender = getUserIdByDisplayName(issueJSON.fields.creator);
    const roomId = testUtils.getRoomId();
    const commandName = 'archive';
    const bodyText = '';
    let baseOptions;
    const notAdminSender = 'notAdmin';
    const [adminSender] = testUtils.roomAdmins;

    beforeEach(() => {
        chatApi = testUtils.getChatApi({ existedUsers: [notAdminSender] });
        baseOptions = { roomId, roomName, commandName, sender, chatApi, bodyText };
        nock(utils.getRestUrl())
            .get(`/issue/${issueJSON.key}`)
            .reply(200, issueJSON);
    });

    afterEach(() => {
        nock.cleanAll();
    });

    // TODO set readable test case names
    it('Permition denided for not admin', async () => {
        const post = translate('notAdmin', { sender: 'notAdmin' });
        const result = await commandHandler({ ...baseOptions, sender: 'notAdmin' });
        expect(result).to.be.eq(post);
    });

    it.skip('Access for admin', async () => {
        const result = await commandHandler({ ...baseOptions, sender: adminSender.userId });
        expect(result).to.be.eq('ok');
    });

    describe('Render list of messages', () => {
        it('Render MD', () => {
            const result = getMDtext(messagesJSON).split('\n');
            expect(result).to.deep.equal(messagesMD.split('\n'));
        });

        it.skip('Render HTML', () => {
            const result = getHTMLtext(messagesJSON);
            expect(result).to.deep.equal(messagesHTML);
        });
    });
});
