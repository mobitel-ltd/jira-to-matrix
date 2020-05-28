import { ChatConfig } from '../types';
import { Commands } from '../bot/commands';
import { LoggerInstance } from 'winston';

export class BaseChatApi {
    constructor(public commands: Commands, public config: ChatConfig, public logger: LoggerInstance, public sdk: any) {}

    getAdmins(): string[] {
        return this.config.messenger.admins;
    }

    /**
     * @example uu_user
     */
    isAdmin(userId: string): boolean {
        return this.getAdmins().includes(userId);
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
