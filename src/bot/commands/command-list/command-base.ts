import { Config, TaskTracker, MessengerApi, CommandOptions } from '../../../types';

export class Command<T extends TaskTracker> {
    constructor(public config: Config, public taskTracker: T, public chatApi: MessengerApi) {}
}

export interface RunCommand {
    run(data: CommandOptions): Promise<string | undefined> | string | undefined;
}
