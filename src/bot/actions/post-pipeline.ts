import * as toYaml from 'js-yaml';
import { getLogger } from '../../modules/log';
import { PostPipelineData } from '../../types';
import { BaseAction } from './base-action';
import { ChatFasade } from '../../messengers/chat-fasade';
import { Gitlab } from '../../task-trackers/gitlab';
import { GitlabPipeline } from '../../task-trackers/gitlab/types';
import { errorTracing } from '../../lib/utils';

const logger = getLogger(module);

export class PostPipeline extends BaseAction<ChatFasade, Gitlab> {
    async run({ author, pipelineData }: PostPipelineData) {
        const res = await Promise.all(
            pipelineData.map(({ header, key, pipeInfo }) => this.sendPipelineData(key, author, pipeInfo, header)),
        );

        return res.filter(Boolean) as string[];
    }

    async sendPipelineData(key: string, author: string, pipeInfo: GitlabPipeline, header: string) {
        try {
            const roomId = await this.chatApi.getRoomId(key);
            const res = PostPipeline.getMessage(header, pipeInfo);
            await this.chatApi.sendTextMessage(roomId, res);

            logger.debug(`Posted pipeline info to ${key} room with id ${roomId} from ${author}\n`);

            return key;
        } catch (error) {
            const errMsg = errorTracing(`Error sending commit data to room with alias ${key} form ${author}`, error);
            logger.error(errMsg);
        }
    }

    static parseCommit = (pipeInfo: GitlabPipeline) => {
        const ymlData = toYaml.safeDump(pipeInfo, { lineWidth: -1 });

        return ymlData;
    };

    static getMessage = (header: string, pipeInfo: GitlabPipeline) => {
        const commitData = PostPipeline.parseCommit(pipeInfo);
        const text = [header, BaseAction.line, commitData].join('\n').concat(BaseAction.line);

        return text;
    };
}
