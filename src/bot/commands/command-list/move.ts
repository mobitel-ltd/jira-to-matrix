import { translate } from '../../../locales';
import * as utils from '../../../lib/utils';

const getCommandAction = (val, collection) => {
    const numberVal = Number(val);
    if (Number.isInteger(numberVal)) {
        return collection[numberVal - 1];
    }
    const lowerVal = val.toLowerCase();

    return collection.find(({ name, to }) => name.toLowerCase() === lowerVal || to.name.toLowerCase() === lowerVal);
};

export const move = async ({ bodyText, sender, roomName, taskTracker }) => {
    const transitions = await taskTracker.getPossibleIssueStatuses(roomName);
    if (!bodyText) {
        return utils.getCommandList(transitions);
    }

    const newStatus = getCommandAction(bodyText, transitions);

    if (!newStatus) {
        return translate('notFoundMove', { bodyText });
    }

    await taskTracker.postIssueStatus(roomName, newStatus.id);

    return translate('successMoveJira', { ...newStatus, sender });
};
