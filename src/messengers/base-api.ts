import { ChatConfig } from '../types';

export class BaseChatApi {
    commandsHandler;
    config: ChatConfig;
    logger;

    constructor(commandsHandler: Function, config, logger) {
        this.commandsHandler = commandsHandler;
        this.config = config;
        this.logger = logger;
    }

    getAdmins(): string[] {
        return this.config.messenger.admins;
    }

    getMyId(): string {
        return this.config.user;
    }

    isMaster(): boolean {
        return Boolean(this.config.isMaster);
    }

    getNotifyData(): { name: string; users: string[] } | undefined {
        return this.config.messenger.infoRoom;
    }

    getCommandRoomName(): string | undefined {
        const data = this.getNotifyData();

        return data && data.name;
    }
}
