import marked from 'marked';
import { translate } from '../../locales';
import { getLogger } from '../../modules/log';
import { redis, getRedisEpicKey } from '../../redis-client';
import { PostEpicUpdatesData } from '../../types';
import { ChatFasade } from '../../messengers/chat-fasade';
import { BaseAction } from './base-action';
import { Jira } from '../../task-trackers/jira';

const logger = getLogger(module);

export class PostEpicUpdates extends BaseAction<ChatFasade, Jira> {
    getNewIssueMessageBody = ({ summary, key }) => {
        const viewUrl = this.taskTracker.getViewUrl(key);
        const values = { key, viewUrl, summary };

        const body = translate('newIssueInEpic');
        const message = translate('issueAddedToEpic', values);
        const htmlBody = marked(message);

        return { body, htmlBody };
    };

    async postNewIssue(roomID: string, { epic, issue }): Promise<void> {
        const redisEpicKey = getRedisEpicKey(epic.id);
        if (await redis.isInEpic(redisEpicKey, issue.id)) {
            logger.debug(`Issue ${issue.key} already saved in Redis by epic ${epic.key}`);

            return;
        }

        const { body, htmlBody } = this.getNewIssueMessageBody(issue);
        await redis.addToList(redisEpicKey, issue.id);
        logger.info(`Info about issue ${issue.key} added to epic ${epic.key}`);

        await this.chatApi.sendHtmlMessage(roomID, body, htmlBody);
    }

    async run({ data, epicKey }: PostEpicUpdatesData): Promise<true> {
        try {
            const roomID = await this.chatApi.getRoomId(epicKey);
            const epic = await this.taskTracker.getIssue(epicKey);

            if (this.config.features.epicUpdates.newIssuesInEpic === 'on') {
                await this.postNewIssue(roomID, { epic, issue: data });
            }
            if (this.config.features.epicUpdates.issuesStatusChanged === 'on') {
                const res = this.getPostStatusData(data);
                if (res) {
                    await this.chatApi.sendHtmlMessage(roomID, res.body, res.htmlBody);
                }
            }

            return true;
        } catch (err) {
            throw ['Error in postEpicUpdates', err].join('\n');
        }
    }
}
