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

    return collection.find(el => el.name.toLowerCase() === val.toLowerCase());
};

export class PrioCommand extends Command<Jira> implements RunCommand {
    async run({ bodyText, roomName }: CommandOptions) {
        if (!roomName) {
            throw new Error('Not issue room');
        }

        const allPriorities = await this.taskTracker.getIssuePriorities(roomName);
        if (!allPriorities) {
            return translate('notPrio');
        }

        if (!bodyText) {
            return utils.getCommandList(allPriorities);
        }

        const priority = getCommandAction(bodyText, allPriorities);

        if (!priority) {
            return translate('notFoundPrio', { bodyText });
        }

        await this.taskTracker.updateIssuePriority(roomName, priority.id);

        return translate('setPriority', priority);
    }
}
