// eslint-disable-next-line prettier/prettier
const voidFunc = (): void => { return; };

const defaultLogger = {
    info: () => voidFunc,
    error: () => voidFunc,
    warn: () => voidFunc,
    debug: () => voidFunc,
};

export class BaseChatApi {
    commandsHandler;
    config;
    logger = defaultLogger;

    constructor(commandsHandler: Function, config, logger) {
        this.commandsHandler = commandsHandler;
        this.config = config;
        this.logger = logger;
    }

    getAdmins(): string[] {
        return this.config.admins;
    }

    getMyId(): string {
        return this.config.user;
    }

    isMaster(): boolean {
        return Boolean(this.config.isMaster);
    }

    getNotifyData(): { name: string; users: string[] } | undefined {
        return this.config.infoRoom;
    }

    getCommandRoomName(): string | undefined {
        const data = this.getNotifyData();

        return data && data.name;
    }
}
