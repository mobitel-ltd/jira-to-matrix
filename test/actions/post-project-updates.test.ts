import genericJSON from '../fixtures/webhooks/issue/updated/generic.json';
import createdJSON from '../fixtures/webhooks/issue/created.json';
import { getPostProjectUpdatesData } from '../../src/jira-hook-parser/parsers/jira/parse-body';
import { isPostProjectUpdates } from '../../src/jira-hook-parser/parsers/jira';
import { postProjectUpdates } from '../../src/bot/actions';
import { getEpicChangedMessageBody, getNewEpicMessageBody } from '../../src/bot/actions/helper';
import { getChatClass, taskTracker, getRoomId } from '../test-utils';
import { config } from '../../src/config';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';

const { expect } = chai;
chai.use(sinonChai);

describe('Post project updates test', () => {
    let chatSingle;
    let options;

    const roomId = getRoomId();
    const postProjectUpdatesData = getPostProjectUpdatesData(genericJSON);

    beforeEach(() => {
        const chatClass = getChatClass({ alias: postProjectUpdatesData.projectKey });
        chatSingle = chatClass.chatApiSingle;
        const chatApi = chatClass.chatApi;

        options = { taskTracker, config, chatApi };
    });

    it('getPostProjectUpdatesData', () => {
        const result = isPostProjectUpdates(genericJSON);
        expect(result).to.be.true;
    });

    it('Expect postProjectUpdates works correct with issue_generic', async () => {
        const { body, htmlBody } = getEpicChangedMessageBody(postProjectUpdatesData.data);

        await postProjectUpdates({ ...options, ...postProjectUpdatesData });
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomId, body, htmlBody);
    });

    it('Expect postProjectUpdates works correct with issue_created', async () => {
        const postProjectUpdatesData2 = getPostProjectUpdatesData(createdJSON);
        const { body, htmlBody } = getNewEpicMessageBody(postProjectUpdatesData2.data);

        await postProjectUpdates({ ...options, ...postProjectUpdatesData2 });
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomId, body, htmlBody);
    });

    it('Expect postProjectUpdates to be thrown if no room is found', async () => {
        let res;
        try {
            await postProjectUpdates({ ...options, ...postProjectUpdatesData, projectKey: 'some_key' });
        } catch (err) {
            res = err;
        }
        expect(res).not.to.undefined;
    });
});
