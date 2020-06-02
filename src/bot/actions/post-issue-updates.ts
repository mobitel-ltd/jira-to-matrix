import { getLogger } from '../../modules/log';
import * as utils from '../../lib/utils';
import * as R from 'ramda';
import { translate } from '../../locales';
import { PostIssueUpdatesData } from '../../types';
import { isRepoExists, getRepoLink, exportEvents } from '../../lib/git-lib';
import { kick } from '../commands/command-list/common-actions';
import { ChatFasade } from '../../messengers/chat-fasade';
import { BaseAction } from './base-action';
import { LAST_STATUS_COLOR } from '../../redis-client';
import { Jira } from '../../task-trackers/jira';

const logger = getLogger(module);

// usingPojects: 'all' | [string] | undefined

export class PostIssueUpdates extends BaseAction<ChatFasade, Jira> {
    async getNewAvatarUrl(issueKey, { statusId, colors, usingPojects }) {
        if (!colors) {
            logger.warn(`No color links is passed to update avatar for room ${issueKey}`);

            return;
        }
        if (!statusId) {
            logger.warn(`No statusId is passed to update avatar for room ${issueKey}`);

            return;
        }

        if (this.isAvatarIssueKey(issueKey, usingPojects)) {
            const data = await this.taskTracker.getStatusData(statusId);

            return data?.colorName && colors[data.colorName];
        }
    }

    fieldNames = items => items.reduce((acc, { field }) => (field ? [...acc, field] : acc), []);

    itemsToString = items =>
        items.reduce((acc, { field, toString }) => (field ? { ...acc, [field]: toString } : acc), {});

    composeText = ({ author, fields, formattedValues }) => {
        const message = translate('issue_updated', { name: author });
        const changesDescription = fields.map(field => `${field}: ${formattedValues[field]}`);

        return [message, ...changesDescription].join('<br>');
    };

    async getIssueUpdateInfoMessageBody({ changelog, oldKey, author }) {
        const fields = this.fieldNames(changelog.items);
        const renderedValues = await this.taskTracker.getRenderedValues(oldKey, fields);

        const changelogItemsTostring = this.itemsToString(changelog.items);
        const formattedValues = { ...changelogItemsTostring, ...renderedValues };

        const htmlBody = this.composeText({ author, fields, formattedValues });
        const body = translate('issueHasChanged');

        return { htmlBody, body };
    }

    async isArchiveStatus(projectKey: string, statusId?: string) {
        if (!statusId) {
            logger.debug('Status is not changed');

            return false;
        }
        const exportConfigParams = this.config.gitArchive;

        const isInConfigArchiveList = R.pipe(
            R.pathOr([], ['options', 'lastIssue']),
            R.includes(projectKey),
        )(exportConfigParams);

        if (isInConfigArchiveList) {
            const data = await this.taskTracker.getStatusData(statusId);

            return data?.colorName === LAST_STATUS_COLOR;
        }

        return false;
    }

    async run({ newStatusId, ...body }: PostIssueUpdatesData): Promise<boolean> {
        try {
            if (!(await this.taskTracker.hasIssue(body.oldKey))) {
                logger.warn(`Issue by key ${body.oldKey} is not exists`);

                return false;
            }

            const roomId = await this.chatApi.getRoomId(body.oldKey);

            if (body.newKey) {
                const topic = this.taskTracker.getViewUrl(body.newKey);
                await this.chatApi.updateRoomData(roomId, topic, body.newKey);
                logger.debug(`Added new topic ${body.newKey} for room ${body.oldKey}`);
            }

            if (body.newNameData) {
                await this.chatApi.updateRoomName(roomId, body.newNameData);
                logger.debug(`Room ${body.oldKey} name updated with ${body.newNameData.summary}`);
            }

            const info = await this.getIssueUpdateInfoMessageBody(body);
            await this.chatApi.sendHtmlMessage(roomId, info.body, info.htmlBody);
            logger.debug(`Posted updates to ${roomId}`);

            const newAvatarUrl = await this.getNewAvatarUrl(body.oldKey, {
                statusId: newStatusId,
                colors: R.path(['colors', 'links'], this.config),
                usingPojects: R.path(['colors', 'projects'], this.config),
            });

            if (newAvatarUrl) {
                await this.chatApi.setRoomAvatar(roomId, newAvatarUrl);

                logger.debug(`Room ${roomId} have got new avatar ${newAvatarUrl}`);
            }

            const projectKey = utils.getProjectKeyFromIssueKey(body.oldKey);
            if (await this.isArchiveStatus(projectKey, newStatusId)) {
                const { baseRemote, baseLink, sshLink, gitReposPath } = this.config;

                const repoName = projectKey;

                if (!(await isRepoExists(this.config.baseRemote, repoName))) {
                    const repoLink = getRepoLink(this.config.baseLink!, projectKey);

                    logger.warn(translate('repoNotExists', { repoLink }));

                    return true;
                }

                const listEvents = await this.chatApi.getAllEventsFromRoom(roomId);
                const { roomData, client } = (await this.chatApi.getRoomAndClient(roomId))!;
                const archivedRoomLinks = await exportEvents({
                    listEvents,
                    roomData,
                    chatApi: client,
                    repoName,
                    baseRemote,
                    baseLink,
                    sshLink,
                    gitReposPath,
                });
                if (!archivedRoomLinks) {
                    logger.debug(translate('archiveFail', { alias: roomData.alias }));

                    return true;
                }

                logger.debug(`Git push successfully complited in room ${roomId}!!!`);

                const kickRes = await kick(client, roomData);

                logger.debug(`Result of kicking in room ${roomData.alias} is ${kickRes}`);
            }

            return true;
        } catch (err) {
            logger.error(err);
            throw utils.errorTracing('postIssueUpdates', err);
        }
    }
}
