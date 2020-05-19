import { Jira } from './jira';

const trackers = {
    jira: Jira,
};

// eslint-disable-next-line valid-jsdoc
/**
 * @param {'jira'} type task type
 * @returns {typeof Jira} task tracker class
 */
export const getTaskTracker = type => trackers[type];
