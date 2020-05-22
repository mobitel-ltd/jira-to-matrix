import { Jira } from './jira';
import { Config, TaskTracker } from '../types';

const trackers = {
    jira: Jira,
};

export const getTaskTracker = (config: Config): TaskTracker =>
    new trackers['jira']({
        url: config.jira.url,
        password: config.jira.password,
        user: config.jira.user,
        count: config.ping && config.ping.count,
        interval: config.ping && config.ping.interval,
        inviteIgnoreUsers: config.inviteIgnoreUsers,
    });
