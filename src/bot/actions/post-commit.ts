import marked from 'marked';
import { getLogger } from '../../modules/log';
import { fromString } from 'html-to-text';
import { PushCommitData } from '../../types';
import { BaseAction, RunAction } from './base-action';
import { ChatFasade } from '../../messengers/chat-fasade';
import { Gitlab } from '../../task-trackers/gitlab';
import { GitlabPushCommit } from '../../task-trackers/gitlab/types';
import { errorTracing } from '../../lib/utils';
import { translate } from '../../locales';

const logger = getLogger(module);

export class PostCommit extends BaseAction<ChatFasade, Gitlab> implements RunAction {
    async run({ author, keyAndCommits }: PushCommitData) {
        const res = await Promise.all(
            Object.entries(keyAndCommits).map(([key, commitInfo]) => this.sendCommitData(key, commitInfo, author)),
        );

        return res.filter(Boolean) as string[];
    }

    static parseCommit = (data: GitlabPushCommit[]): string[] => {
        return data.map(el => {
            const text = el.id.slice(0, 8);
            const link = el.url;

            return `[${text}](${link})`;
        });
    };

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

    static getCommitHTMLBody = (name: string, commitInfo: GitlabPushCommit[]) => {
        const jsonData = marked(['```json', JSON.stringify(commitInfo, null, 2), '```'].join('\n'));
        const headerText = translate('pushCommitInfo', { name });
        const commitsLinks = PostCommit.parseCommit(commitInfo).join(' ');

        return marked(`${headerText}: ${commitsLinks} \n\n${jsonData}`);
    };
}
