import * as R from 'ramda';
import { translate } from '../../locales';
import { getCommandDict } from './command-list';
import { getLogger } from '../../modules/log';
import { Config, TaskTracker, RunCommandsOptions, CommandNames } from '../../types';
import { RunCommand } from './command-list/command-base';

const logger = getLogger(module);

export class Commands {
    constructor(private config: Config, private taskTracker: TaskTracker) {}

    getErrMessage = (err: any): string => {
        if (typeof err === 'string') {
            return err;
        }
        if (err instanceof Error) {
            return err.name;
        }

        return err;
    };

    async run(
        commandName: string | CommandNames,
        { chatApi, roomData, roomId, roomName, sender, bodyText, url, senderDisplayName }: RunCommandsOptions,
    ) {
        try {
            if (R.pipe(R.pathOr([], ['ignoreCommands']), R.includes(commandName))(this.config)) {
                const message = translate('ignoreCommand', { commandName });
                logger.warn(message);
                await chatApi.sendHtmlMessage(roomId, message, message);

                return message;
            }

            const commandDict = getCommandDict(this.config, this.taskTracker, chatApi);
            const command: RunCommand | undefined = commandDict[commandName];
            if (!command) {
                return;
            }
            const message = await command.run({
                bodyText,
                roomId,
                roomName,
                sender,
                roomData,
                url,
                senderDisplayName,
            });

            if (message) {
                await chatApi.sendHtmlMessage(roomId, message, message);
            }
            // TODO remove after setting roomData to all tests
            logger.debug(
                `${commandName} successfully executed by "${sender}" in room id "${roomData?.id ||
                    roomId}" with alias "${roomData?.alias || roomName}"`,
            );

            return message;
        } catch (err) {
            const errMessage = this.getErrMessage(err);
            //const post = translate('errorMatrixCommands');
            await chatApi.sendHtmlMessage(roomId, errMessage, errMessage);
            logger.error(err);
        }
    }
}
