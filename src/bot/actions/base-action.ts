import { Config, TaskTracker } from '../../types';
import marked from 'marked';
import { translate } from '../../locales';
import { getLogger } from '../../modules/log';

const logger = getLogger(module);

export class Action<T> {
    constructor(public config: Config, public taskTracker: TaskTracker, public chatApi: T) {}

    getPostStatusData = (data): { body: string; htmlBody: string } | undefined => {
        if (!data.status) {
            logger.warn('No status in getPostStatusData');

            return;
        }

        const viewUrl = this.taskTracker.getViewUrl(data.key);

        const body = translate('statusHasChanged', { ...data, viewUrl });
        const message = translate('statusHasChangedMessage', { ...data, viewUrl }, data.name);
        const htmlBody = marked(message);

        return { body, htmlBody };
    };

    getPostLinkMessageBody = ({ relation, related }, action = 'newLink') => {
        const key = this.taskTracker.selectors.getKey(related)!;
        const viewUrl = this.taskTracker.getViewUrl(key);
        const summary = this.taskTracker.selectors.getSummary(related);
        const values = { key, relation, summary, viewUrl };

        const body = translate(action);
        const htmlBodyAction = related ? `${action}Message` : action;

        const message = translate(htmlBodyAction, values);
        const htmlBody = marked(message);

        return { body, htmlBody };
    };

    isAvatarIssueKey = (issueKey, usingPojects) => {
        if (!usingPojects) {
            logger.warn(`No usingPojects is passed to update avatar for room ${issueKey}`);

            return false;
        }

        if (usingPojects === 'all') {
            return true;
        }

        const [projectKey] = issueKey.split('-');
        if (usingPojects.includes(projectKey)) {
            return true;
        }
        logger.warn(`Project with key ${projectKey} is not exist in config. Avatar will not be updated.`);

        return false;
    };

    getDefaultAvatarLink = (key, type, colorsConfigData) => {
        if (!colorsConfigData) {
            return;
        }

        if (this.isAvatarIssueKey(key, colorsConfigData.projects)) {
            return colorsConfigData.links[type];
        }
    };
}

export interface RunAction {
    run(data): Promise<boolean | undefined | string[]>;
}
