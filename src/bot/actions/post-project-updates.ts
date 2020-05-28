/* eslint-disable @typescript-eslint/camelcase */
import marked from 'marked';
import { translate } from '../../locales';
import { Action, RunAction } from './base-action';
import { ChatFasade } from '../../messengers/chat-fasade';

export class PostProjectUpdates extends Action<ChatFasade> implements RunAction {
    getMsg = {
        issue_created: this.getNewEpicMessageBody,
        issue_generic: this.getEpicChangedMessageBody,
    };

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

    async run({ chatApi, typeEvent, projectKey, data }) {
        try {
            const roomId = await chatApi.getRoomId(projectKey);

            const { body, htmlBody } = this.getMsg[typeEvent](data);
            await chatApi.sendHtmlMessage(roomId, body, htmlBody);

            return true;
        } catch (err) {
            throw ['Error in postProjectUpdates', err].join('\n');
        }
    }
}
