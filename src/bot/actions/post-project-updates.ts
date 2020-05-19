/* eslint-disable @typescript-eslint/camelcase */
import { getNewEpicMessageBody, getEpicChangedMessageBody } from './helper';

const getMsg = {
    issue_created: getNewEpicMessageBody,
    issue_generic: getEpicChangedMessageBody,
};
export const postProjectUpdates = async ({ chatApi, typeEvent, projectKey, data }) => {
    try {
        const roomId = await chatApi.getRoomId(projectKey);

        const { body, htmlBody } = getMsg[typeEvent](data);
        await chatApi.sendHtmlMessage(roomId, body, htmlBody);

        return true;
    } catch (err) {
        throw ['Error in postProjectUpdates', err].join('\n');
    }
};
