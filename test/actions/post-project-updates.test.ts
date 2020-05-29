import genericJSON from '../fixtures/webhooks/issue/updated/generic.json';
import createdJSON from '../fixtures/webhooks/issue/created.json';
import { getChatClass, taskTracker, getRoomId } from '../test-utils';
import { config } from '../../src/config';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { PostProjectUpdates } from '../../src/bot/actions/post-project-updates';
import { PostProjectUpdatesData } from '../../src/types';

const { expect } = chai;
chai.use(sinonChai);

describe('Post project updates test', () => {
    let chatSingle;
    let options: PostProjectUpdatesData;
    let postProjectUpdates: PostProjectUpdates;

    const roomId = getRoomId();
    const postProjectUpdatesData = taskTracker.parser.getPostProjectUpdatesData(genericJSON);

    beforeEach(() => {
        const chatClass = getChatClass({ alias: postProjectUpdatesData.projectKey });
        chatSingle = chatClass.chatApiSingle;
        const chatApi = chatClass.chatApi;
        postProjectUpdates = new PostProjectUpdates(config, taskTracker, chatApi);
    });

    it('getPostProjectUpdatesData', () => {
        const result = taskTracker.parser.isPostProjectUpdates(genericJSON);
        expect(result).to.be.true;
    });

    it('Expect postProjectUpdates works correct with issue_generic', async () => {
        const { body, htmlBody } = postProjectUpdates.getEpicChangedMessageBody(postProjectUpdatesData.data as any);

        await postProjectUpdates.run({ ...options, ...postProjectUpdatesData });
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomId, body, htmlBody);
    });

    it('Expect postProjectUpdates works correct with issue_created', async () => {
        const postProjectUpdatesData2 = taskTracker.parser.getPostProjectUpdatesData(createdJSON);
        const { body, htmlBody } = postProjectUpdates.getNewEpicMessageBody(postProjectUpdatesData2.data);

        await postProjectUpdates.run({ ...options, ...postProjectUpdatesData2 });
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomId, body, htmlBody);
    });

    it('Expect postProjectUpdates to be thrown if no room is found', async () => {
        let res;
        try {
            await postProjectUpdates.run({ ...options, ...postProjectUpdatesData, projectKey: 'some_key' });
        } catch (err) {
            res = err;
        }
        expect(res).not.to.undefined;
    });
});
