import { Jira } from './jira';
import { Config, TaskTracker } from '../types';
import { Gitlab } from './gitlab';

const trackers = {
    jira: Jira,
    gitlab: Gitlab,
};

export const getTaskTracker = (config: Config): TaskTracker => {
    switch (config.taskTracker.type) {
        case 'jira':
            return new trackers['jira']({
                url: config.taskTracker.url,
                password: config.taskTracker.password,
                user: config.taskTracker.user,
                count: config.ping && config.ping.count,
                interval: config.ping && config.ping.interval,
                inviteIgnoreUsers: config.inviteIgnoreUsers,
                features: config.features,
            });
        case 'gitlab':
            return new trackers['gitlab']({
                url: config.taskTracker.url,
                password: config.taskTracker.password,
                user: config.taskTracker.user,
                count: config.ping && config.ping.count,
                interval: config.ping && config.ping.interval,
                features: config.features,
                inviteIgnoreUsers: config.inviteIgnoreUsers,
                defaultLabel: config.taskTracker.defaultLabel,
            });
    }
};
