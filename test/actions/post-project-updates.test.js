const genericJSON = require('../fixtures/webhooks/issue/updated/generic.json');
const createdJSON = require('../fixtures/webhooks/issue/created.json');
const { getPostProjectUpdatesData } = require('../../src/jira-hook-parser/parse-body.js');
const { isPostProjectUpdates } = require('../../src/jira-hook-parser/bot-handler.js');
const { postProjectUpdates } = require('../../src/bot/actions');
const { getEpicChangedMessageBody, getNewEpicMessageBody } = require('../../src/bot/actions/helper');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const { expect } = chai;
const testUtils = require('../test-utils');
chai.use(sinonChai);

describe('Post project updates test', () => {
    let chatApi;

    const roomId = testUtils.getRoomId();
    const postProjectUpdatesData = getPostProjectUpdatesData(genericJSON);

    beforeEach(() => {
        chatApi = testUtils.getChatApi({ alias: postProjectUpdatesData.projectKey });
    });

    it('getPostProjectUpdatesData', () => {
        const result = isPostProjectUpdates(genericJSON);
        expect(result).to.be.true;
    });

    it('Expect postProjectUpdates works correct with issue_generic', async () => {
        const { body, htmlBody } = getEpicChangedMessageBody(postProjectUpdatesData.data);

        await postProjectUpdates({ chatApi, ...postProjectUpdatesData });
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, body, htmlBody);
    });

    it('Expect postProjectUpdates works correct with issue_created', async () => {
        const postProjectUpdatesData2 = getPostProjectUpdatesData(createdJSON);
        const { body, htmlBody } = getNewEpicMessageBody(postProjectUpdatesData2.data);

        await postProjectUpdates({ chatApi, ...postProjectUpdatesData2 });
        expect(chatApi.sendHtmlMessage).to.be.calledWithExactly(roomId, body, htmlBody);
    });

    it('Expect postProjectUpdates to be thrown if no room is found', async () => {
        let res;
        try {
            await postProjectUpdates({ chatApi, ...postProjectUpdatesData, projectKey: 'some_key' });
        } catch (err) {
            res = err;
        }
        expect(res).not.to.undefined;
    });
});
