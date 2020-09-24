import { createCanvas } from 'canvas';
import { Config, TaskTracker, MessengerApi } from '../../types';
import marked from 'marked';
import { translate } from '../../locales';
import { getLogger } from '../../modules/log';
import { ChatFasade } from '../../messengers/chat-fasade';
import { REDIS_INVITE_PREFIX, redis } from '../../redis-client';

const logger = getLogger(module);

export abstract class BaseAction<T extends ChatFasade, Task extends TaskTracker> {
    public taskTracker: Task;
    currentChatItem: MessengerApi;
    defaultAvatarColor = 'white';
    static line = Array.from({ length: 40 }, () => '-').join('');

    constructor(public config: Config, taskTracker: Task, public chatApi: T) {
        this.currentChatItem = this.chatApi.getCurrentClient();
        this.taskTracker = taskTracker.init() as Task;
    }

    getPostStatusData = (data): { body: string; htmlBody: string } | undefined => {
        if (!data.status) {
            logger.warn('No status in getPostStatusData');

            return;
        }

        const viewUrl = this.taskTracker.getViewUrl(data.key);

        const body = translate('statusHasChanged', { ...data, viewUrl });
        const message = translate('statusHasChangedMessage', { ...data, viewUrl }, data.name);
        const htmlBody = marked(message);

        return { body, htmlBody };
    };

    getPostLinkMessageBody = ({ relation, related }, action = 'newLink') => {
        const key = this.taskTracker.selectors.getKey(related)!;
        const viewUrl = this.taskTracker.getViewUrl(key);
        const summary = this.taskTracker.selectors.getSummary(related);
        const values = { key, relation, summary, viewUrl };

        const body = translate(action);
        const htmlBodyAction = related ? `${action}Message` : action;

        const message = translate(htmlBodyAction, values);
        const htmlBody = marked(message);

        return { body, htmlBody };
    };

    isIssueUseAvatars = (issueKey: string) => {
        const usingPojects = this.config.colors.projects;
        if (!usingPojects) {
            logger.warn(`No usingPojects is passed to update avatar for room ${issueKey}`);

            return false;
        }

        if (usingPojects === 'all') {
            return true;
        }

        const [projectKey] = issueKey.split('-');
        if (usingPojects.includes(projectKey)) {
            return true;
        }
        logger.warn(`Project with key ${projectKey} is not exist in config. Avatar will not be updated.`);

        return false;
    };

    // some colors in jira have cannot be painted, special codes should be used
    getColorCode = (colorName: string): string => {
        const colorDict = {
            'blue-gray': '#6699cc',
        };

        return colorDict[colorName] || colorName;
    };

    drawLogo(colorList?: string[]): Buffer {
        const baseColors = colorList?.length ? colorList : ['white'];
        const colors = baseColors.map(this.getColorCode);
        const radius = 200;
        const canvas = createCanvas(radius * 2, radius * 2);
        const ctx = canvas.getContext('2d');
        const pieAngle = (2 * Math.PI) / colors.length;

        colors.forEach((color, index) => {
            ctx.beginPath();
            ctx.moveTo(radius, radius);
            const startAngle = index * pieAngle;
            const endAngle = (index + 1) * pieAngle;
            ctx.arc(radius, radius, radius, startAngle, endAngle, false);
            ctx.fillStyle = color;
            ctx.fill();
        });

        return canvas.toBuffer();
    }

    async getAvatarLink(key: string, statusColors: string[] | string): Promise<string | undefined> {
        const { colors } = this.config;
        if (!colors) {
            return;
        }

        if (this.isIssueUseAvatars(key)) {
            const colorsToHandle = typeof statusColors === 'string' ? [statusColors] : statusColors;
            const buffer = this.drawLogo(colorsToHandle);

            return await this.currentChatItem.uploadContent(buffer, 'image/png');
        }
    }

    async getAutoinviteUsers(projectKey: string, typeName: string): Promise<string[]> {
        const dataJSON = await redis.getAsync(REDIS_INVITE_PREFIX);
        const data = dataJSON ? JSON.parse(dataJSON) : {};
        const { [projectKey]: currentInvite = {} } = data;
        const { [typeName]: autoinviteUsers = [] } = currentInvite;

        return autoinviteUsers.map((el: string) => this.chatApi.getChatUserId(el));
    }

    abstract run(data): Promise<boolean | undefined | string[] | string>;
}
