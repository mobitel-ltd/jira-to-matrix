import { Jira } from './jira';

const trackers = {
    jira: Jira,
};

export const getTaskTracker = (type: 'jira') => trackers[type];
