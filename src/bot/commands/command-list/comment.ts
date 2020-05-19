import { translate } from '../../../locales';

export const comment = async ({ bodyText, sender, roomName, taskTracker }) => {
    if (bodyText) {
        await taskTracker.postComment(roomName, sender, bodyText);

        return;
    }

    return translate('emptyMatrixComment');
};
