const genericJSON = require('../fixtures/webhooks/issue/updated/generic.json');
const createdJSON = require('../fixtures/webhooks/issue/created.json');
const {getPostProjectUpdatesData} = require('../../src/jira-hook-parser/parse-body.js');
const {isPostProjectUpdates} = require('../../src/jira-hook-parser/bot-handler.js');
const {postProjectUpdates} = require('../../src/bot');
const {getEpicChangedMessageBody, getNewEpicMessageBody} = require('../../src/bot/helper');
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

    const postProjectUpdatesData = getPostProjectUpdatesData(genericJSON);

    it('getPostProjectUpdatesData', () => {
        const result = isPostProjectUpdates(genericJSON);
        expect(result).to.be.true;
    });

    it('Expect postProjectUpdates works correct with issue_generic', async () => {
        const {body, htmlBody} = getEpicChangedMessageBody(postProjectUpdatesData.data);

        await postProjectUpdates({mclient, ...postProjectUpdatesData});
        expect(mclient.sendHtmlMessage).to.be.calledWithExactly(roomId, body, htmlBody);
    });

    it('Expect postProjectUpdates works correct with issue_created', async () => {
        const postProjectUpdatesData2 = getPostProjectUpdatesData(createdJSON);
        const {body, htmlBody} = getNewEpicMessageBody(postProjectUpdatesData2.data);

        await postProjectUpdates({mclient, ...postProjectUpdatesData2});
        expect(mclient.sendHtmlMessage).to.be.calledWithExactly(roomId, body, htmlBody);
    });

    it('Expect postProjectUpdates to be thrown if no room is found', async () => {
        const errName = 'Error!';
        mclient.getRoomId.throws(errName);
        let res;
        try {
            res = await postProjectUpdates({mclient, ...postProjectUpdatesData});
        } catch (err) {
            res = err;
        }
        expect(res).to.include(errName);
    });
});
