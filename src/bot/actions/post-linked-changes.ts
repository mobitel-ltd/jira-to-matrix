import * as utils from '../../lib/utils';
import { PostLinkedChangesActions } from '../../types';
import { getPostStatusData } from './helper';

const handler = (chatApi, data) => async roomID => {
    const { body, htmlBody } = getPostStatusData(data)!;

    await chatApi.sendHtmlMessage(roomID, body, htmlBody);
};

export const postLinkedChanges = async ({
    chatApi,
    linksKeys,
    data,
    taskTracker,
}: PostLinkedChangesActions): Promise<true> => {
    try {
        const checkedIssues = await Promise.all(
            linksKeys.map(async key => {
                const issue = await taskTracker.getIssueSafety(key);

                return issue && key;
            }),
        );
        const availableIssues = checkedIssues.filter(Boolean);
        const roomIDs = await Promise.all(availableIssues.map(chatApi.getRoomIdForJoinedRoom.bind(chatApi)));

        await Promise.all(roomIDs.map(handler(chatApi, data)));

        return true;
    } catch (err) {
        throw utils.errorTracing('postLinkedChanges', err);
    }
};
