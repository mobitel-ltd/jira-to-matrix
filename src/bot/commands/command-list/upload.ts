import { Command, RunCommand } from './command-base';
import { CommandOptions } from '../../../types';
import { Gitlab } from '../../../task-trackers/gitlab';
import { getLogger } from '../../../modules/log';
const logger = getLogger(module);

export class UploadCommand extends Command<Gitlab> implements RunCommand {
    async run({ bodyText, sender, roomData, url }: CommandOptions): Promise<undefined> {
        if (!url || !roomData.alias) {
            return;
        }
        if (!this.taskTracker.selectors.isIssueRoomName(roomData.alias)) {
            logger.warn('Skip commenting in not issue room ' + roomData.alias);

            return;
        }

        const { fullUrl, markdown } = await this.taskTracker.upload(roomData.alias, {
            url,
            fileName: bodyText!,
        });

        logger.debug(`Image successfully uploaded to url ${fullUrl}`);

        await this.taskTracker.postComment(roomData.alias, { sender }, markdown);
    }
}
