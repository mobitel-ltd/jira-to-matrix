import * as toYaml from 'js-yaml';
import { getLogger } from '../../modules/log';
import { PushCommitData } from '../../types';
import { BaseAction } from './base-action';
import { ChatFasade } from '../../messengers/chat-fasade';
import { Gitlab } from '../../task-trackers/gitlab';
import { GitlabPushCommit } from '../../task-trackers/gitlab/types';
import { errorTracing } from '../../lib/utils';
import { translate } from '../../locales';
import { GitlabParser } from '../../task-trackers/gitlab/parser.gtilab';
const logger = getLogger(module);

export class PostCommit extends BaseAction<ChatFasade, Gitlab> {
    async run({ author, keyAndCommits }: PushCommitData) {
        const res = await Promise.all(
            Object.entries(keyAndCommits).map(([key, commitInfo]) => this.sendCommitData(key, commitInfo, author)),
        );

        return res.filter(Boolean) as string[];
    }

    // static getCommitLinks = (data: GitlabPushCommit[], projectNamespace: string): string[] => {
    //     return data.map(el => {
    //         const text = el.id.slice(0, 8);
    //         const link = el.url;

    //         return `* [${projectNamespace}@${text}](${link})`;
    //     });
    // };

    async sendCommitData(key: string, commitInfo: GitlabPushCommit[], author: string) {
        try {
            const roomId = await this.chatApi.getRoomId(key);
            const res = PostCommit.getCommitMessage(author, commitInfo);
            await this.chatApi.sendTextMessage(roomId, res);

            logger.debug(`Posted comment with commit info to ${key} room with id ${roomId} from ${author}\n`);

            return key;
        } catch (error) {
            const errMsg = errorTracing(`Error sending commit data to room with alias ${key} form ${author}`, error);
            logger.error(errMsg);
        }
    }

    static parseCommit = (commitInfo: GitlabPushCommit[]) => {
        const parseCommit = commitInfo.map(el => {
            const output = {
                id: el.id,
                message: el.message,
                timestamp: el.timestamp,
                url: el.url,
            };

            const filteredOutput = {
                added: el.added,
                modified: el.modified,
                removed: el.removed,
            };
            return Object.assign(output, GitlabParser.stageFilter(filteredOutput));
        });

        const ymlData = toYaml.safeDump(parseCommit, { lineWidth: -1 });
        return ymlData;
        // const jsonData = JSON.stringify(commitInfo, null, 2);
        // return ['<pre><code class="language-yaml"> ', ymlData, '\n</code></pre>\n'].join('');
        // return marked(['```', jsonData, '```'].join('\n'));
    };

    static getCommitMessage = (name: string, commitInfo: GitlabPushCommit[]) => {
        // const commitsLinks = PostCommit.getCommitLinks(commitInfo, projectNamespace).join('\n');
        const email = commitInfo.map(el => el.author.email)[0];
        // created by Vlad, check it please :)
        const userName = name.split(' ', 1)[0];
        const fullName = name.replace(userName + ' ', '');

        const headerText = translate('pushCommitInfo', { userName, fullName, email });
        const commitData = PostCommit.parseCommit(commitInfo);
        const line = Array.from({ length: 40 }, () => '-').join('');
        const text = [headerText, line, commitData, line].join('\n');
        return text;
    };
}
