import { fromString } from 'html-to-text';
import marked from 'marked';
import { getLogger } from '../../modules/log';
import { translate } from '../../locales';
import { getAutoinviteUsers } from '../settings';
import { infoBody } from '../../lib/messages';
import { CreateRoomData, MessengerApi, TaskTracker } from '../../types';
import { errorTracing } from '../../lib/utils';
import { LINE_BREAKE_TAG, INDENT } from '../../lib/consts';
import { BaseAction, RunAction } from './base-action';

const logger = getLogger(module);

export const getOpenedDescriptionBlock = data => [LINE_BREAKE_TAG, INDENT, data].join('');

export const getClosedDescriptionBlock = data => [getOpenedDescriptionBlock(data), LINE_BREAKE_TAG].join('');

// eslint-disable-next-line

export class CreateRoom extends BaseAction<MessengerApi, TaskTracker> implements RunAction {
    getEpicInfo(epicLink) {
        epicLink === translate('miss')
            ? ''
            : `            <br>Epic link:
                ${getOpenedDescriptionBlock(epicLink)}
                ${getClosedDescriptionBlock(this.taskTracker.getViewUrl(epicLink))}`;
    }

    getPost(body) {
        const post = `
            Assignee:
                ${getOpenedDescriptionBlock(body.assigneeName)}
            <br>Reporter:
                ${getOpenedDescriptionBlock(body.reporterName)}
            <br>Type:
                ${getClosedDescriptionBlock(body.typeName)}
            <br>Estimate time:
                ${getClosedDescriptionBlock(body.estimateTime)}
            <br>Description:
                ${getClosedDescriptionBlock(marked(body.description))}
            <br>Priority:
                ${getClosedDescriptionBlock(body.priority)}`;

        const epicInfo = this.getEpicInfo(body.epicLink);

        return [post, epicInfo].join('\n');
    }

    getDescription(issue): { body: string; htmlBody: string } {
        try {
            const descriptionFields = this.taskTracker.selectors.getDescriptionFields(issue);
            const htmlBody = this.getPost(descriptionFields);
            const body = fromString(htmlBody);

            return { body, htmlBody };
        } catch (err) {
            throw errorTracing('getDescription', err);
        }
    }

    async createIssueRoom(issue): Promise<void> {
        try {
            const { colors } = this.config;
            const {
                key,
                summary,
                projectKey,
                descriptionFields: { typeName },
            } = issue;

            const autoinviteUsers = await getAutoinviteUsers(projectKey, typeName);

            const issueWatchers = await this.taskTracker.getIssueWatchers(issue.key);
            const issueWatchersChatIds = await Promise.all(
                issueWatchers.map(displayName => this.chatApi.getUserIdByDisplayName(displayName)),
            );

            const invite = [...issueWatchersChatIds, ...autoinviteUsers];

            const name = this.chatApi.composeRoomName(key, summary);
            const topic = this.taskTracker.getViewUrl(key);

            const avatarUrl = this.getDefaultAvatarLink(key, 'issue', colors);

            const options = {
                room_alias_name: key,
                invite,
                name,
                topic,
                purpose: summary,
                avatarUrl,
            };

            const roomId = await this.chatApi.createRoom(options);

            logger.info(`Created room for ${key}: ${roomId}`);
            const { body, htmlBody } = this.getDescription(issue);

            await this.chatApi.sendHtmlMessage(roomId, body, htmlBody);
            await this.chatApi.sendHtmlMessage(roomId, infoBody, infoBody);
        } catch (err) {
            throw errorTracing('createIssueRoom', err);
        }
    }

    async createProjectRoom(projectKey) {
        try {
            const { lead, name: projectName } = await this.taskTracker.getProject(projectKey);
            const name = this.chatApi.composeRoomName(projectKey, projectName);
            const leadUserId = await this.chatApi.getUserIdByDisplayName(lead);
            const topic = this.taskTracker.getViewUrl(projectKey);

            const options = {
                room_alias_name: projectKey,
                invite: [leadUserId],
                name,
                topic,
            };

            const roomId = await this.chatApi.createRoom(options);
            logger.info(`Created room for project ${projectKey}: ${roomId}`);
        } catch (err) {
            throw errorTracing('createProjectRoom', err);
        }
    }

    async getCheckedIssue(issueData) {
        const issueBody = await this.taskTracker.getIssueSafety(issueData.key || issueData.id);
        if (!issueBody) {
            return issueData;
        }

        return {
            ...issueData,
            key: this.taskTracker.selectors.getKey(issueBody),
            roomMembers: this.taskTracker.selectors.getMembers(issueBody),
            summary: this.taskTracker.selectors.getSummary(issueBody),
            descriptionFields: this.taskTracker.selectors.getDescriptionFields(issueBody),
        };
    }

    hasData(issue) {
        return issue.key && issue.summary;
    }

    async run({ issue, projectKey }: CreateRoomData): Promise<boolean> {
        try {
            const keyOrId = issue.key || issue.id;
            if (issue && keyOrId) {
                if (!(await this.taskTracker.hasIssue(keyOrId))) {
                    logger.warn(`Issue ${keyOrId} is not exists`);

                    return false;
                }
                const checkedIssue = this.hasData(issue) ? issue : await this.getCheckedIssue(issue);

                (await this.chatApi.getRoomIdByName(checkedIssue.key)) || (await this.createIssueRoom(checkedIssue));
            }
            if (projectKey) {
                (await this.chatApi.getRoomIdByName(projectKey)) || (await this.createProjectRoom(projectKey));
            }

            return true;
        } catch (err) {
            throw errorTracing('create room', err);
        }
    }
}
