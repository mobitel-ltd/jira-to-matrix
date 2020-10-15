import { getChatClass } from '../test-utils';
import { config } from '../../src/config';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { Gitlab } from '../../src/task-trackers/gitlab';
import gitlabPushHook from '../fixtures/webhooks/gitlab/push-event.json';
import { PostCommit } from '../../src/bot/actions/post-commit';
import { GitlabPushHook } from '../../src/task-trackers/gitlab/types';

const { expect } = chai;
chai.use(sinonChai);

describe('Post commit', () => {
    let chatApi;
    let chatSingle;
    let postCommit: PostCommit;
    const gitlabTracker = new Gitlab({ ...config.taskTracker, features: config.features });

    const roomId = 'roomId';
    const postPushCommitData = gitlabTracker.parser.getPostPushCommitData(gitlabPushHook as GitlabPushHook);

    beforeEach(() => {
        const chatClass = getChatClass({ alias: Object.keys(postPushCommitData.keyAndCommits) });
        chatSingle = chatClass.chatApiSingle;
        chatApi = chatClass.chatApi;

        postCommit = new PostCommit(config, gitlabTracker, chatApi);
    });

    // it.skip('should parse commit', async () => {
    //     const res = PostCommit.getCommitLinks(gitlabPushHook.commits);
    //     const header = `[${gitlabPushHook.project.path_with_namespace}@${gitlabPushHook.commits[0].id.slice(0, 8)}](${gitlabPushHook.commits[0].url})`;
    //     const expected = [`* ${header}`];
    //     expect(res).to.be.deep.eq(expected);
    // });

    it('Expect postCommit works correct with push hook and', async () => {
        const commitData = gitlabPushHook.commits;
        const res = PostCommit.getCommitMessage(
            gitlabPushHook.user_username + ' ' + gitlabPushHook.user_name,
            commitData,
        );
        const result = await postCommit.run(postPushCommitData);

        expect(result).to.be.deep.eq(Object.keys(postPushCommitData.keyAndCommits));
        expect(chatSingle.sendTextMessage).to.be.calledWithExactly(roomId, res);
    });
});
