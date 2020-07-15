import marked from 'marked';
import { getLogger } from '../../modules/log';
import { fromString } from 'html-to-text';
import { PushCommitData } from '../../types';
import { BaseAction, RunAction } from './base-action';
import { ChatFasade } from '../../messengers/chat-fasade';
import { Gitlab } from '../../task-trackers/gitlab';
import { GitlabPushCommit } from '../../task-trackers/gitlab/types';
import { errorTracing } from '../../lib/utils';

const logger = getLogger(module);

export class PostCommit extends BaseAction<ChatFasade, Gitlab> implements RunAction {
    async run({ author, keyAndCommits }: PushCommitData) {
        const res = await Promise.all(
            Object.entries(keyAndCommits).map(([key, commitInfo]) => this.sendCommitData(key, commitInfo, author)),
        );

        return res.filter(Boolean) as string[];
    }
    async sendCommitData(key: string, commitInfo: GitlabPushCommit[], author: string) {
        try {
            const roomId = await this.chatApi.getRoomId(key);
            const message = PostCommit.getCommitHTMLBody(author, commitInfo);
            await this.chatApi.sendHtmlMessage(roomId, fromString(message), message);

            logger.debug(`Posted comment with commit info to ${key} room with id ${roomId} from ${author}\n`);

            return key;
        } catch (error) {
            const errMsg = errorTracing(`Error sending commit data to room with alias ${key} form ${author}`, error);
            logger.error(errMsg);
        }
    }

    static getCommitHTMLBody = (author: string, commitInfo: GitlabPushCommit[]) => {
        const jsonData = marked(['```', JSON.stringify(commitInfo, null, 2), '```'].join('\n'));

        return marked(`${author} mentioned this current issue in commits: \n\n${jsonData}`);
    };
}
