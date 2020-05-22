import {
    getDataFromRedis,
    getRedisRooms,
    handleRedisData,
    handleRedisRooms,
    getCommandKeys,
    handleCommandKeys,
} from './redis-data-handle';
import { config } from '../config';
import { getLogger } from '../modules/log';
import { MessengerFasade, TaskTracker } from '../types';

const logger = getLogger(module);

export const queueHandler = (taskTracker: TaskTracker) => async (chatApi: MessengerFasade) => {
    try {
        const redisRooms = await getRedisRooms();
        await handleRedisRooms(chatApi.getCurrentClient(), redisRooms, taskTracker);

        const dataFromRedis = await getDataFromRedis();
        await handleRedisData(chatApi, dataFromRedis, config, taskTracker);

        const commandKeys = await getCommandKeys();
        await handleCommandKeys(chatApi, commandKeys, config, taskTracker);
    } catch (err) {
        logger.error('Error in queue handling', err);
    }
};
