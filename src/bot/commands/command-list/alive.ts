import { translate } from '../../../locales';

export const alive = ({ roomName, chatApi }) => {
    if (chatApi.getCommandRoomName() !== roomName) {
        return translate('notCommandRoom');
    }

    const botId = chatApi.getMyId();
    const message = translate('alive', { botId });

    return message;
};
