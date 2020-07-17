import * as toYaml from 'js-yaml';
import { getLogger } from '../../modules/log';
import { PostPipelineData } from '../../types';
import { BaseAction, RunAction } from './base-action';
import { ChatFasade } from '../../messengers/chat-fasade';
import { Gitlab } from '../../task-trackers/gitlab';
import { GitlabPipeline } from '../../task-trackers/gitlab/types';
import { errorTracing } from '../../lib/utils';

const logger = getLogger(module);

export class PostPipeline extends BaseAction<ChatFasade, Gitlab> implements RunAction {
    async run({ author, issueKeys, pipelineData }: PostPipelineData) {
        const res = await Promise.all(issueKeys.map(key => this.sendPipelineData(key, author, pipelineData)));

        return res.filter(Boolean) as string[];
    }

    async sendPipelineData(key: string, author: string, pipelineData: GitlabPipeline) {
        try {
            const roomId = await this.chatApi.getRoomId(key);
            const keyData = this.taskTracker.selectors.transformFromKey(key);
            const repoName = keyData.namespaceWithProject.split('/').reverse()[0];
            const res = PostPipeline.getMessage(pipelineData, repoName);
            await this.chatApi.sendTextMessage(roomId, res);

            logger.debug(`Posted pipeline info to ${key} room with id ${roomId} from ${author}\n`);

            return key;
        } catch (error) {
            const errMsg = errorTracing(`Error sending commit data to room with alias ${key} form ${author}`, error);
            logger.error(errMsg);
        }
    }

    static parseCommit = (pipelineData: GitlabPipeline) => {
        const ymlData = toYaml.safeDump(pipelineData, { lineWidth: -1 });

        return ymlData;
    };

    static getHeader = (project: string, ref: string, status: string) => `${project} (${ref}): ${status}`;

    static getMessage = (pipelineData: GitlabPipeline, project: string) => {
        const header = PostPipeline.getHeader(
            project,
            pipelineData.object_attributes.ref,
            pipelineData.object_attributes.status,
        );
        const commitData = PostPipeline.parseCommit(pipelineData);
        const text = [header, BaseAction.line, commitData].join('\n').concat(BaseAction.line);

        return text;
    };
}
