import { getLogger } from '../../modules/log';
import { UploadData } from '../../types';
import { BaseAction, RunAction } from './base-action';
import { ChatFasade } from '../../messengers/chat-fasade';
import { Gitlab } from '../../task-trackers/gitlab';
import marked from 'marked';
import { translate } from '../../locales';

const logger = getLogger(module);

export const getCommentHTMLBody = (headerText, commentBody) => `${headerText}: <br>${commentBody}`;

export class Upload extends BaseAction<ChatFasade, Gitlab> implements RunAction {
    async run({ issueKey, uploadInfo: headerText, uploadUrl }: UploadData) {
        try {
            const roomId = await this.chatApi.getRoomId(issueKey);
            const result = await this.chatApi.upload(roomId, uploadUrl);
            if (!result) {
                const messageWithLink = translate('uploadLink', { url: uploadUrl, headerText: headerText });
                const markedMessage = marked(messageWithLink);
                logger.debug(`Link to file was successfully sending in room with id ${roomId}`);
                await this.chatApi.sendHtmlMessage(roomId, messageWithLink, markedMessage);
            } else {
                logger.debug(`File was successfully uploaded in room with id ${roomId}`);
                await this.chatApi.sendHtmlMessage(roomId, headerText, headerText);
            }

            return true;
        } catch (err) {
            throw ['Error in file upload', err].join('\n');
        }
    }
}
