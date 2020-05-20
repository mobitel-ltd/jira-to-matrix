import * as marked from 'marked';
import * as utils from '../../lib/utils';
import { getLogger } from '../../modules/log';
import { translate } from '../../locales';

const logger = getLogger(module);

export const getEpicChangedMessageBody = ({ summary, key, status, name }) => {
    const viewUrl = utils.getViewUrl(key);
    const values = { name, key, summary, status, viewUrl };

    const body = translate('statusEpicChanged');
    const message = translate('statusEpicChangedMessage', values, values.name);
    const htmlBody = marked(message);

    return { body, htmlBody };
};

export const getNewEpicMessageBody = ({ key, summary }) => {
    const viewUrl = utils.getViewUrl(key);
    const values = { key, summary, viewUrl };

    const body = translate('newEpicInProject');
    const message = translate('epicAddedToProject', values);
    const htmlBody = marked(message);

    return { body, htmlBody };
};

export const getPostStatusData = (data): { body: string; htmlBody: string } | undefined => {
    if (!data.status) {
        logger.warn('No status in getPostStatusData');

        return;
    }

    const viewUrl = utils.getViewUrl(data.key);

    const body = translate('statusHasChanged', { ...data, viewUrl });
    const message = translate('statusHasChangedMessage', { ...data, viewUrl }, data.name);
    const htmlBody = marked(message);

    return { body, htmlBody };
};

export const getNewIssueMessageBody = ({ summary, key }) => {
    const viewUrl = utils.getViewUrl(key);
    const values = { key, viewUrl, summary };

    const body = translate('newIssueInEpic');
    const message = translate('issueAddedToEpic', values);
    const htmlBody = marked(message);

    return { body, htmlBody };
};

export const getPostLinkMessageBody = ({ relation, related }, action = 'newLink') => {
    const key = utils.getKey(related);
    const viewUrl = utils.getViewUrl(key);
    const summary = utils.getSummary(related);
    const values = { key, relation, summary, viewUrl };

    const body = translate(action);
    const htmlBodyAction = related ? `${action}Message` : action;

    const message = translate(htmlBodyAction, values);
    const htmlBody = marked(message);

    return { body, htmlBody };
};

export const isAvatarIssueKey = (issueKey, usingPojects) => {
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

export const getDefaultAvatarLink = (key, type, colorsConfigData) => {
    if (!colorsConfigData) {
        return;
    }

    if (isAvatarIssueKey(key, colorsConfigData.projects)) {
        return colorsConfigData.links[type];
    }
};
