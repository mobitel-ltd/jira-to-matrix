import marked from 'marked';
import { getLogger } from '../../modules/log';
import { fromString } from 'html-to-text';
import { PushCommitData } from '../../types';
import { BaseAction, RunAction } from './base-action';
import { ChatFasade } from '../../messengers/chat-fasade';
import { Gitlab } from '../../task-trackers/gitlab';
import { GitlabPushCommit } from '../../task-trackers/gitlab/types';

const logger = getLogger(module);

export class PostCommit extends BaseAction<ChatFasade, Gitlab> implements RunAction {
    async run({ author, keyAndCommits }: PushCommitData) {
        try {
            await Promise.all(
                Object.entries(keyAndCommits).map(([key, commitInfo]) => this.sendCommitData(key, commitInfo, author)),
            );
            return true;
        } catch (err) {
            throw ['Error in Post comment', err].join('\n');
        }
    }
    async sendCommitData(key: string, commitInfo: GitlabPushCommit[], author: string) {
        try {
            const roomId = await this.chatApi.getRoomId(key);
            const message = this.getCommitHTMLBody(author, commitInfo);
            await this.chatApi.sendHtmlMessage(roomId, fromString(message), message);

            logger.debug(`Posted comment with commit info to ${key} room with id ${roomId} from ${author}\n`);
        } catch (error) {
            logger.error(error);
        }
    }

    getCommitHTMLBody = (author: string, commitInfo: GitlabPushCommit[]) => {
        const jsonData = marked(['```', JSON.stringify(commitInfo, null, 2), '```'].join('\n'));

        return marked(`${author} mentioned this current issue in commits: \n\n${jsonData}`);
    };
}
