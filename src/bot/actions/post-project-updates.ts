/* eslint-disable @typescript-eslint/camelcase */
import marked from 'marked';
import { translate } from '../../locales';
import { BaseAction } from './base-action';
import { ChatFasade } from '../../messengers/chat-fasade';
import { TaskTracker } from '../../types';

export class PostProjectUpdates extends BaseAction<ChatFasade, TaskTracker> {
    getMsg(type, data) {
        const dict = {
            issue_created: this.getNewEpicMessageBody.bind(this),
            issue_generic: this.getEpicChangedMessageBody.bind(this),
        };
        const runner = dict[type];

        return runner(data);
    }

    getNewEpicMessageBody({ key, summary }) {
        const viewUrl = this.taskTracker.getViewUrl(key);
        const values = { key, summary, viewUrl };

        const body = translate('newEpicInProject');
        const message = translate('epicAddedToProject', values);
        const htmlBody = marked(message);

        return { body, htmlBody };
    }

    getEpicChangedMessageBody({ summary, key, status, name }) {
        const viewUrl = this.taskTracker.getViewUrl(key);
        const values = { name, key, summary, status, viewUrl };

        const body = translate('statusEpicChanged');
        const message = translate('statusEpicChangedMessage', values, values.name);
        const htmlBody = marked(message);

        return { body, htmlBody };
    }

    async run({ typeEvent, projectKey, data }) {
        try {
            const roomId = await this.chatApi.getRoomId(projectKey);

            const { body, htmlBody } = this.getMsg(typeEvent, data);
            await this.chatApi.sendHtmlMessage(roomId, body, htmlBody);

            return true;
        } catch (err) {
            throw ['Error in postProjectUpdates', err].join('\n');
        }
    }
}
