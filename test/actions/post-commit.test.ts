import { fromString } from 'html-to-text';
import { getChatClass } from '../test-utils';
import { config } from '../../src/config';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { Gitlab } from '../../src/task-trackers/gitlab';
import gitlabPushHook from '../fixtures/webhooks/gitlab/push-event.json';
import { PostCommit, getCommitHTMLBody } from '../../src/bot/actions/post-commit';

const { expect } = chai;
chai.use(sinonChai);

describe('Post commit', () => {
    let chatApi;
    let chatSingle;
    let postComment: PostCommit;
    const gitlabTracker = new Gitlab({ ...config.taskTracker, features: config.features });

    const roomId = 'roomId';
    const postPushCommitData = gitlabTracker.parser.getPostPushCommitData(gitlabPushHook);

    beforeEach(() => {
        const chatClass = getChatClass({ alias: Object.keys(postPushCommitData.keyAndCommits) });
        chatSingle = chatClass.chatApiSingle;
        chatApi = chatClass.chatApi;

        postComment = new PostCommit(config, gitlabTracker, chatApi);
    });

    it('Expect postCommit works correct with push hook and', async () => {
        const commitData = Object.values(postPushCommitData.keyAndCommits)[0];
        const htmlBody = getCommitHTMLBody(postPushCommitData.author, commitData);
        const result = await postComment.run(postPushCommitData);

        expect(result).to.be.true;
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(roomId, fromString(htmlBody), htmlBody);
    });
});
