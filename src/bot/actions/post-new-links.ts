import * as utils from '../../lib/utils';
import { getLogger } from '../../modules/log';
import { redis } from '../../redis-client';
import { PostNewLinksActions } from '../../types';
import { getPostLinkMessageBody } from './helper';

const logger = getLogger(module);

const postLink = async (key, relations, chatApi, taskTracker): Promise<void> => {
    const issue = await taskTracker.getIssueSafety(key);
    if (issue) {
        const roomID = await chatApi.getRoomId(key);

        const { body, htmlBody } = getPostLinkMessageBody(relations);
        await chatApi.sendHtmlMessage(roomID, body, htmlBody);
    }
};

const handleLink = (chatApi, taskTracker) => async issueLinkId => {
    try {
        if (!(await redis.isNewLink(issueLinkId))) {
            logger.debug(`link ${issueLinkId} is already been posted to room`);
            return;
        }

        const link = await taskTracker.getLinkedIssue(issueLinkId);
        const { inward, outward } = utils.getRelations(link);

        await postLink(utils.getOutwardLinkKey(link), inward, chatApi, taskTracker);
        await postLink(utils.getInwardLinkKey(link), outward, chatApi, taskTracker);
        logger.debug(`Issue link ${issueLinkId} is successfully posted!`);
    } catch (err) {
        throw utils.errorTracing('handleLink', err);
    }
};

export const postNewLinks = async ({ chatApi, links, taskTracker }: PostNewLinksActions): Promise<true> => {
    try {
        await Promise.all(links.map(handleLink(chatApi, taskTracker)));
        return true;
    } catch (err) {
        throw utils.errorTracing('post new link', err);
    }
};
