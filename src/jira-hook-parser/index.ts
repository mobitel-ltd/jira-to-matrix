import { config } from '../config';
import { getFuncAndBody } from './bot-handler';
import { isIgnore } from './is-ignore';
import { saveIncoming, saveToHandled } from '../queue/redis-data-handle';
import { getLogger } from '../modules/log';
import { TaskTracker } from '../types';

const logger = getLogger(module);

const { usersToIgnore, testMode } = config;
/**
 * Is ignore data
 * @async
 * @param {object} body hook body
 * @param {string[]} _usersToIgnore users to ignore
 * @param {{on: boolean, users: string[]}} _testMode test mode data
 * @returns {boolean} ignore or not
 */
export const getParsedAndSaveToRedis = async (
    taskTracker: TaskTracker,
    body: any,
    _usersToIgnore = usersToIgnore,
    _testMode = testMode,
) => {
    try {
        const ignoredUsers = [..._usersToIgnore, ...testMode.users];
        const mode = _testMode.on;
        if (await isIgnore(body, ignoredUsers, mode, taskTracker)) {
            return;
        }

        const parsedBody = getFuncAndBody(body);
        const handledKeys = (await Promise.all(parsedBody.map(saveIncoming))).filter(Boolean);

        await saveToHandled(handledKeys);

        return true;
    } catch (err) {
        logger.error('Error in parsing ', err);

        return false;
    }
};
