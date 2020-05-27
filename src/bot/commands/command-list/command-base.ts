import { Config, TaskTracker, MessengerApi, CommandOptions } from '../../../types';

export class Command {
    constructor(public config: Config, public taskTracker: TaskTracker, public chatApi: MessengerApi) {}
}

export interface RunCommand {
    run(data: CommandOptions): Promise<string | undefined> | string | undefined;
}
