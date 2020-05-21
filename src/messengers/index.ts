import { SlackApi } from './slack-api';
import { MatrixApi } from './matrix-api';

const messengers = {
    matrix: MatrixApi,
    slack: SlackApi,
};

export const getChatClass = (type: 'matrix' | 'slack'): typeof SlackApi | typeof MatrixApi => messengers[type];
