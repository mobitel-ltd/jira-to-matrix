import * as helper from '../bot/actions/helper';
import * as messages from '../lib/messages';
import { getLogger } from '../modules/log';

const logger = getLogger(module);

export const isIgnore = async (body, usersToIgnore, testMode) => {
    const projectStatus = await helper.getIgnoreProject(body, usersToIgnore, testMode);
    const msg = messages.getWebhookStatusLog({ projectStatus });

    logger.info(msg);

    // return userStatus.ignoreStatus || projectStatus.ignoreStatus;
    return projectStatus.ignoreStatus;
};
