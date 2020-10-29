import delay from 'delay';
import * as R from 'ramda';
import { getLogger } from '../../modules/log';
import * as utils from '../../lib/utils';
import { kick } from '../commands/command-list/common-actions';
import { exportEvents } from '../../lib/git-lib';
import { ArchiveProjectData, MessengerApi, RoomData } from '../../types';
import { ChatFasade } from '../../messengers/chat-fasade';
import { BaseAction } from './base-action';
import { Jira } from '../../task-trackers/jira';

const logger = getLogger(module);

export enum StateEnum {
    // rooms which have messages which sent after keeping date
    STILL_ACTIVE = 'still active',
    // room is archived, all users kicked and alias deleted
    ARCHIVED = 'successfully archived and kicked',
    // room not found by alias, it has bben removed before or never been created
    NOT_FOUND = 'alias is not found',
    // room has no one bot but it was made and left before, alias of this room is removed
    ALIAS_REMOVED = 'alias removed in left room',
    // alias and roomid exists but bots has no power to delete it, maybe it was made by test bot
    OTHER_ALIAS_CREATOR = 'other alias creator',
    // error archiving
    ERROR_ARCHIVING = 'error archiving',
    // some problem during getting events, archive stop
    FORBIDDEN_EVENTS = 'cannot get events',
    // room alias is changed, it means that issue has been moved to another project
    MOVED = 'issue moved to another project',
    // room alias is not received by room meta data and we can't do any action with it
    ROOM_NOT_RETURN_ALIAS = 'no alias from room meta',
    // issue status is not equals to status which was in args
    ANOTHER_STATUS = 'issue is in another status',
}

const getAccum = (): Record<StateEnum, string[]> => ({
    [StateEnum.STILL_ACTIVE]: [],
    [StateEnum.ARCHIVED]: [],
    [StateEnum.NOT_FOUND]: [],
    [StateEnum.ALIAS_REMOVED]: [],
    [StateEnum.OTHER_ALIAS_CREATOR]: [],
    [StateEnum.ERROR_ARCHIVING]: [],
    [StateEnum.FORBIDDEN_EVENTS]: [],
    [StateEnum.MOVED]: [],
    [StateEnum.ROOM_NOT_RETURN_ALIAS]: [],
    [StateEnum.ANOTHER_STATUS]: [],
});

const isMessage = item => item.type === 'm.room.message';

export interface ArchiveOptions {
    alias: string;
    keepTimestamp: number;
    status?: string;
}

export class ArchiveProject extends BaseAction<ChatFasade, Jira> {
    static getLastMessageTimestamp = events =>
        events
            .filter(isMessage)
            .map(item => item.origin_server_ts)
            .reduce((acc, val) => (acc > val ? acc : val), 0);

    async archiveAndForget({
        client,
        roomData,
        keepTimestamp,
    }: {
        client: MessengerApi;
        roomData: RoomData;
        keepTimestamp: number;
    }) {
        try {
            const allEvents = await this.chatApi.getAllEventsFromRoom(roomData.id);
            if (!allEvents) {
                return StateEnum.FORBIDDEN_EVENTS;
            }
            const lastMessageTimestamp = ArchiveProject.getLastMessageTimestamp(allEvents);
            logger.debug(
                `Last message was made -- ${new Date(lastMessageTimestamp)}, keeping date --${new Date(keepTimestamp)}`,
            );
            if (lastMessageTimestamp > keepTimestamp) {
                logger.debug(`${roomData.alias} is still active, skip archive`);

                return StateEnum.STILL_ACTIVE;
            }
            const repoLinks = await exportEvents({
                listEvents: allEvents,
                chatApi: client,
                roomData,
                repoName: utils.getProjectKeyFromIssueKey(roomData.alias),
                ...(this.config as any),
            });
            if (!repoLinks) {
                logger.error(`Some fail has happen after attempt to archive room with alias ${roomData.alias}`);

                return StateEnum.ERROR_ARCHIVING;
            }

            logger.info(`Room "${roomData.alias}" with id ${roomData.id} is archived to ${repoLinks.httpLink}`);

            await kick(client, roomData);
            await client.leaveRoom(roomData.id);

            return StateEnum.ARCHIVED;
        } catch (error) {
            logger.error(utils.errorTracing(`archiving room ${roomData.alias}`, error));

            return StateEnum.ERROR_ARCHIVING;
        }
    }

    async deleteByEachBot(alias) {
        const allBotsClients = this.chatApi.getAllInstance();
        const res = await Promise.all(allBotsClients.map(api => api.deleteRoomAlias(alias)));
        if (res.some(Boolean)) {
            logger.info(`Alias "${alias}" is deleted`);

            return StateEnum.ALIAS_REMOVED;
        }
        logger.warn(`No bot has made alias "${alias}"`);

        return StateEnum.OTHER_ALIAS_CREATOR;
    }

    async handleKnownRoom({ keepTimestamp, roomId, alias, status }) {
        const data = await this.chatApi.getRoomAndClient(roomId);
        if (!data) {
            logger.debug(`No bot can get room meta by alias ${alias} they are not joined. Try remove it.`);

            return this.deleteByEachBot(alias);
        }

        if (status) {
            const issueCurrentStatus = await this.taskTracker.getCurrentStatus(alias);
            if (issueCurrentStatus && issueCurrentStatus !== status) {
                logger.warn(
                    `Issue with key ${alias} has status "${issueCurrentStatus}". Expected is "${status}". Skip archiving`,
                );

                return StateEnum.ANOTHER_STATUS;
            }
        }

        const currentMainAlias = data.roomData.alias;
        if (!currentMainAlias) {
            logger.warn(`Room with id ${roomId} cannot return current alias. It has been found by alias ${alias}.`);

            return StateEnum.ROOM_NOT_RETURN_ALIAS;
        }

        // the last room alias is new
        if (data.roomData.alias !== alias) {
            logger.warn(`Room with id ${roomId} has moved alias from  ${alias} to ${data.roomData.alias}`);
            await this.deleteByEachBot(alias);

            return StateEnum.MOVED;
        }

        const state = await this.archiveAndForget({ ...data, keepTimestamp });
        if (state === StateEnum.ARCHIVED) {
            await this.deleteByEachBot(alias);
        }

        return state;
    }

    async getRoomArchiveState({ alias, keepTimestamp, status }: ArchiveOptions) {
        const roomId = await this.chatApi.getRoomIdByName(alias);

        return roomId ? this.handleKnownRoom({ keepTimestamp, roomId, alias, status }) : StateEnum.NOT_FOUND;
    }

    async runArchive({ projectKey, lastNumber, keepTimestamp, status }): Promise<Record<StateEnum, string[]>> {
        const iter = async (num: number, accum: Record<StateEnum, string[]>): Promise<Record<StateEnum, string[]>> => {
            if (num === 0) {
                logger.info(`All project "${projectKey}" rooms are handled`);

                return accum;
            }

            // make delay to avoid overload matrix server
            await delay(this.config.delayInterval);
            const alias = [projectKey, num].join('-');
            const startTime = Date.now();

            const state = await this.getRoomArchiveState({ status, keepTimestamp, alias });
            const { min, sec } = utils.timing(startTime);
            logger.info(`Room with alias ${alias} archiving try time: ${min} min ${sec} sec`);

            accum[state].push(alias);

            return iter(num - 1, accum);
        };

        return iter(lastNumber, getAccum());
    }

    async run({ projectKey, keepTimestamp, status }: ArchiveProjectData): Promise<any> {
        try {
            logger.info('Start archiving project');

            const lastIssueKey = await this.taskTracker.getLastIssueKey(projectKey);
            if (lastIssueKey) {
                const lastNumber = R.pipe(R.split('-'), R.last, parseInt)(lastIssueKey);

                const res = await this.runArchive({
                    projectKey,
                    lastNumber,
                    keepTimestamp: Number(keepTimestamp),
                    status,
                });

                const commandRoom = this.chatApi.getCommandRoomName();

                if (commandRoom) {
                    const commandRoomId = await this.chatApi.getRoomIdByName(commandRoom);
                    const preparedMsg =
                        res &&
                        Object.entries(res)
                            .map(([key, val]) => `${key} >>> ${val.length ? val : 'none'}`)
                            .join('<br>');
                    await this.chatApi.sendHtmlMessage(commandRoomId as string, preparedMsg);
                }

                return res;
            }

            logger.warn(`No issue key is found in project ${projectKey}. Skip archiving`);

            return false;
        } catch (err) {
            logger.error(err);
            throw utils.errorTracing('archiveProject', err);
        }
    }
}
