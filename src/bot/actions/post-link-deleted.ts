import * as utils from '../../lib/utils';
import { DeletedLinksActions } from '../../types';
import { getNoIssueLinkLog } from '../../lib/messages';
import { getPostLinkMessageBody } from './helper';

const postLink = async (roomID, related, relation, chatApi): Promise<void> => {
    if (roomID) {
        const { body, htmlBody } = getPostLinkMessageBody({ relation, related }, 'deleteLink');

        await chatApi.sendHtmlMessage(roomID, body, htmlBody);
    }
};

export const postLinksDeleted = async ({
    chatApi,
    sourceIssueId,
    destinationIssueId,
    sourceRelation,
    destinationRelation,
    taskTracker,
}: DeletedLinksActions): Promise<true> => {
    try {
        const links = [sourceIssueId, destinationIssueId];
        const [sourceIssue, destinationIssue] = await Promise.all(links.map(el => taskTracker.getIssueSafety(el)));
        if (!sourceIssue && !destinationIssue) {
            throw getNoIssueLinkLog(sourceIssueId, destinationIssueId);
        }
        const [sourceIssueKey, destinationIssueKey] = [sourceIssue, destinationIssue].map(utils.getKey)!;

        const sourceIssueRoomId = sourceIssueKey && (await chatApi.getRoomId(sourceIssueKey));
        const destinationIssueRoomId = destinationIssueKey && (await chatApi.getRoomId(destinationIssueKey));

        await postLink(sourceIssueRoomId, destinationIssue, sourceRelation, chatApi);
        await postLink(destinationIssueRoomId, sourceIssue, destinationRelation, chatApi);

        return true;
    } catch (err) {
        throw utils.errorTracing('post delete link', err);
    }
};
