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
        const chatClass = getChatClass({ alias: postPipelineData.pipelineData.map(el => el.key) });
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

    it('Expect postPipeline works correct with push hook and', async () => {
        const res = PostPipeline.getMessage(
            postPipelineData.pipelineData[0].header,
            postPipelineData.pipelineData[0].pipeInfo,
        );
        const result = await postPipeline.run(postPipelineData);

        expect(result).to.be.deep.eq(postPipelineData.pipelineData.map(el => el.key));
        expect(chatSingle.sendTextMessage).to.be.calledWithExactly(roomId, res);
    });
});
