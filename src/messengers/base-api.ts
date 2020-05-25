import { ChatConfig } from '../types';
import { commandsHandlerType } from '../bot/commands';
import { LoggerInstance } from 'winston';

export class BaseChatApi {
    constructor(
        public commandsHandler: commandsHandlerType,
        public config: ChatConfig,
        public logger: LoggerInstance,
    ) {}

    getAdmins(): string[] {
        return this.config.messenger.admins;
    }

    getMyId(): string {
        return this.config.user;
    }

    isMaster(): boolean {
        return Boolean(this.config.isMaster);
    }

    getNotifyData(): { name: string; users?: string[] } | undefined {
        return this.config.messenger.infoRoom;
    }

    getCommandRoomName(): string | undefined {
        const data = this.getNotifyData();

        return data && data.name;
    }
}
