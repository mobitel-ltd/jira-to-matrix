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

const logger = getLogger(module);

export const queueHandler = async chatApi => {
    try {
        const redisRooms = await getRedisRooms();
        await handleRedisRooms(chatApi.getCurrentClient(), redisRooms);

        const dataFromRedis = await getDataFromRedis();
        await handleRedisData(chatApi, dataFromRedis, config);

        const commandKeys = await getCommandKeys();
        await handleCommandKeys(chatApi, commandKeys, config);
    } catch (err) {
        logger.error('Error in queue handling', err);
    }
};
