const JSONbody = require('../fixtures/webhooks/issue/updated/generic.json');
const {getPostProjectUpdatesData} = require('../../src/jira-hook-parser/parse-body.js');
const {isPostProjectUpdates} = require('../../src/jira-hook-parser/bot-handler.js');
const {postProjectUpdates} = require('../../src/bot');
const {getEpicChangedMessageBody} = require('../../src/bot/helper');
const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('Post project updates test', () => {
    const roomId = 'roomId';

    const mclient = {
        sendHtmlMessage: stub(),
        getRoomId: stub().resolves(roomId),
    };

    const postProjectUpdatesData = getPostProjectUpdatesData(JSONbody);

    it('getPostProjectUpdatesData', () => {
        const result = isPostProjectUpdates(JSONbody);
        expect(result).to.be.true;
    });

    it('postProjectUpdates', async () => {
        //     "issue_event_type_name": "issue_generic" in JSONbody
        const {body, htmlBody} = getEpicChangedMessageBody(postProjectUpdatesData.data);

        await postProjectUpdates({mclient, ...postProjectUpdatesData});
        expect(mclient.sendHtmlMessage).to.be.calledWithExactly(roomId, body, htmlBody);
    });
});
