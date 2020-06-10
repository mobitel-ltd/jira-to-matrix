import { translate } from '../../../locales';
import { Command, RunCommand } from './command-base';
import { CommandOptions, TaskTracker } from '../../../types';

const getParsedRooms = room => {
    const [issueName] = room.name.split(' ');
    const project = issueName.includes('-') ? issueName.split('-')[0] : 'others';

    return {
        ...room,
        project,
    };
};

export class GetInfoCommand extends Command<TaskTracker> implements RunCommand {
    async run({ roomName, bodyText }: CommandOptions) {
        if (this.chatApi.getCommandRoomName() !== roomName) {
            return translate('notCommandRoom');
        }

        const rooms = this.chatApi.getRooms();
        const parsedRooms = rooms.map(getParsedRooms).filter(room => (bodyText ? room.project === bodyText : true));
        const singleRooms = parsedRooms.filter(room => room.members.length === 1);

        const messageParams = {
            allRooms: parsedRooms.length,
            single: singleRooms.length,
            many: parsedRooms.length - singleRooms.length,
        };

        return translate('getInfo', messageParams);
    }
}
