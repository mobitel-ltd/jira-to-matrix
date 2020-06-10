import { translate } from '../../../locales';
import * as utils from '../../../lib/utils';
import { Command, RunCommand } from './command-base';
import { CommandOptions } from '../../../types';
import { Jira } from '../../../task-trackers/jira';

const getCommandAction = (val, collection) => {
    const numberVal = Number(val);
    if (Number.isInteger(numberVal)) {
        return collection[numberVal - 1];
    }
    const lowerVal = val.toLowerCase();

    return collection.find(({ name, to }) => name.toLowerCase() === lowerVal || to.name.toLowerCase() === lowerVal);
};

export class MoveCommand extends Command<Jira> implements RunCommand {
    async run({ bodyText, sender, roomName }: CommandOptions) {
        if (!roomName) {
            throw new Error('Not issue room');
        }

        const transitions = await this.taskTracker.getPossibleIssueStatuses(roomName);
        if (!bodyText) {
            return utils.getCommandList(transitions);
        }

        const newStatus = getCommandAction(bodyText, transitions);

        if (!newStatus) {
            return translate('notFoundMove', { bodyText });
        }

        await this.taskTracker.postIssueStatus(roomName, newStatus.id);

        return translate('successMoveJira', { ...newStatus, sender });
    }
}
