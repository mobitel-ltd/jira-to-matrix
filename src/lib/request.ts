import requestPromise from 'request-promise-native';
import { getRequestErrorLog } from './messages';
import { TIMEOUT } from '../lib/consts';
import { getLogger } from '../modules/log';

const logger = getLogger(module);

export const fileRequest = async (url, newOptions?: requestPromise.RequestPromiseOptions) => {
    const options = {
        url,
        timeout: TIMEOUT,
        encoding: null,
        ...newOptions,
    };
    try {
        const response = await requestPromise.get(options);
        logger.debug(`Get media file by request with url ${url} suceeded`);

        return response;
    } catch (err) {
        throw getRequestErrorLog(url, err.statusCode, 'GET');
    }
};
