import marked from 'marked';
import { getLogger } from '../../modules/log';
import { fromString } from 'html-to-text';
import { PushCommitData, CommitInfo } from '../../types';
import { BaseAction, RunAction } from './base-action';
import { ChatFasade } from '../../messengers/chat-fasade';
import { Gitlab } from '../../task-trackers/gitlab';

const logger = getLogger(module);

export const getCommitHTMLBody = (author: string, commitInfo: CommitInfo[]) => {
    const jsonData = commitInfo
        .map(el =>
            Object.entries(el)
                .map(([key, val]) => `${key}: ${val.length ? val : 'none'}`)
                .join('<br>'),
        )
        .join('\n- - - - - - - - - - - - - -\n');

    return marked(`${author} mentioned this current issue in commits: \n\n${jsonData}`);
};

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
    async sendCommitData(key: string, commitInfo: CommitInfo[], author: string) {
        try {
            const roomId = await this.chatApi.getRoomId(key);
            const message = getCommitHTMLBody(author, commitInfo);
            await this.chatApi.sendHtmlMessage(roomId, fromString(message), message);

            logger.debug(`Posted comment with commit info to ${key} room with id ${roomId} from ${author}\n`);
        } catch (error) {
            logger.error(error);
        }
    }
}
