import * as utils from '../../lib/utils';
import { getLogger } from '../../modules/log';
import { redis } from '../../redis-client';
import { getNewIssueMessageBody, getPostStatusData } from './helper';
import { PostEpicUpdatesActions, MessengerFasade } from '../../types';

const logger = getLogger(module);

const postNewIssue = async (roomID: string, { epic, issue }, chatApi: MessengerFasade): Promise<void> => {
    const redisEpicKey = utils.getRedisEpicKey(epic.id);
    if (await redis.isInEpic(redisEpicKey, issue.id)) {
        logger.debug(`Issue ${issue.key} already saved in Redis by epic ${epic.key}`);

        return;
    }

    const { body, htmlBody } = getNewIssueMessageBody(issue);
    await redis.addToList(redisEpicKey, issue.id);
    logger.info(`Info about issue ${issue.key} added to epic ${epic.key}`);

    await chatApi.sendHtmlMessage(roomID, body, htmlBody);
};

export const postEpicUpdates = async ({
    chatApi,
    data,
    epicKey,
    config,
    taskTracker,
}: PostEpicUpdatesActions): Promise<true> => {
    try {
        const roomID = await chatApi.getRoomId(epicKey);
        const epic = await taskTracker.getIssue(epicKey);

        if (config.features.epicUpdates.newIssuesInEpic === 'on') {
            await postNewIssue(roomID, { epic, issue: data }, chatApi);
        }
        if (config.features.epicUpdates.issuesStatusChanged === 'on') {
            const res = getPostStatusData(data);
            if (res) {
                await chatApi.sendHtmlMessage(roomID, res.body, res.htmlBody);
            }
        }

        return true;
    } catch (err) {
        throw ['Error in postEpicUpdates', err].join('\n');
    }
};
