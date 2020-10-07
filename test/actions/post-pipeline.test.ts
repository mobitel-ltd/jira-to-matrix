// import path from 'path';
// import fs from 'fs';
import { getChatClass } from '../test-utils';
import { config } from '../../src/config';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { Gitlab } from '../../src/task-trackers/gitlab';
import pipelineHook from '../fixtures/webhooks/gitlab/pipe-success.json';
import { GitlabPipelineHook } from '../../src/task-trackers/gitlab/types';
import { PostPipeline } from '../../src/bot/actions/post-pipeline';

const { expect } = chai;
chai.use(sinonChai);

describe('Post pipeline', () => {
    let chatApi;
    let chatSingle;
    let postPipeline: PostPipeline;
    const gitlabTracker = new Gitlab({ ...config.taskTracker, features: config.features });

    const roomId = 'roomId';
    const postPipelineData = gitlabTracker.parser.getPostPipelineData(pipelineHook as GitlabPipelineHook);

    beforeEach(() => {
        const chatClass = getChatClass({ alias: postPipelineData.issueKeys });
        chatSingle = chatClass.chatApiSingle;
        chatApi = chatClass.chatApi;

        postPipeline = new PostPipeline(config, gitlabTracker, chatApi);
    });

    // it('expect parse work correct', () => {
    //     const filePath = path.resolve(__dirname, '..', 'fixtures/webhooks/gitlab/pipeline/final.yaml');
    //     const expected = fs.readFileSync(filePath, 'utf-8');
    //     const res = PostPipeline.parseCommit(postPipelineData.pipelineData);
    //     expect(res).to.eq(expected);
    // });

    // it.skip('Expect postPipeline works correct with push hook and', async () => {
    //     const keyData = gitlabTracker.selectors.transformFromIssueKey(postPipelineData.issueKeys[0]);
    //     const repoName = keyData.namespaceWithProject.split('/').reverse()[0];
    //     const res = PostPipeline.getMessage(postPipelineData.pipelineData, repoName);
    //     const result = await postPipeline.run(postPipelineData);

    //     expect(result).to.be.deep.eq(postPipelineData.issueKeys);
    //     expect(chatSingle.sendTextMessage).to.be.calledWithExactly(roomId, res);
    // });
});
