import { getLogger } from '../../modules/log';
import { UploadData } from '../../types';
import { BaseAction } from './base-action';
import { ChatFasade } from '../../messengers/chat-fasade';
import { Gitlab } from '../../task-trackers/gitlab';

const logger = getLogger(module);

export const getCommentHTMLBody = (headerText, commentBody) => `${headerText}: <br>${commentBody}`;

export class Upload extends BaseAction<ChatFasade, Gitlab> {
    async run({ issueKey, uploadInfo: headerText, uploadUrl }: UploadData) {
        try {
            const roomId = await this.chatApi.getRoomId(issueKey);
            await this.chatApi.upload(roomId, uploadUrl);

            logger.debug(`File was successfully uploaded in room with id ${roomId}`);
            await this.chatApi.sendHtmlMessage(roomId, headerText, headerText);

            return true;
        } catch (err) {
            throw ['Error in file upload', err].join('\n');
        }
    }
}
