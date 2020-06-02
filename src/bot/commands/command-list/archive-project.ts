/* eslint-disable id-length */
import { DateTime } from 'luxon';
import { setArchiveProject } from '../../settings';
import { translate } from '../../../locales';
import { getLogger } from '../../../modules/log';
import { parseBodyText } from './common-actions';
import { Command, RunCommand } from './command-base';
import { CommandOptions } from '../../../types';
import { Jira } from '../../../task-trackers/jira';

const logger = getLogger(module);

export const DEFAULT_MONTH = 3;

export const LAST_ACTIVE_OPTION = 'lastactive';
export const STATUS_OPTION = 'status';

const getValidateMonth = data => {
    if (!data) {
        return DEFAULT_MONTH;
    }
    const numeric = Number(data);

    return Number.isInteger(numeric) && numeric;
};

export class ProjectArchiveCommand extends Command<Jira> implements RunCommand {
    async run({ bodyText, roomData }: CommandOptions) {
        if (!this.chatApi.isMaster()) {
            logger.warn('Skip operation for not master bot');

            return;
        }

        if (this.chatApi.getCommandRoomName() !== roomData.alias) {
            return translate('notCommandRoom');
        }

        if (!bodyText) {
            return translate('emptyProject');
        }

        const textOptions = parseBodyText(bodyText, {
            alias: {
                l: LAST_ACTIVE_OPTION,
                s: STATUS_OPTION,
            },
            string: [LAST_ACTIVE_OPTION, STATUS_OPTION],
            first: true,
        });

        if (textOptions.hasUnknown()) {
            return translate('unknownArgs', { unknownArgs: textOptions.unknown });
        }

        const projectKey = textOptions.param;
        const customMonths = textOptions.get(LAST_ACTIVE_OPTION);

        const month = getValidateMonth(customMonths);
        if (!month) {
            logger.warn(`Command archiveproject was made with incorrect option arg ${customMonths}`);

            return translate('notValid', { body: customMonths });
        }

        if (!projectKey || !(await this.taskTracker.isJiraPartExists(projectKey))) {
            logger.warn(`Command archiveproject was made with incorrect project ${projectKey}`);

            return translate('issueNotExistOrPermDen');
        }

        const keepTimestamp = DateTime.local()
            .minus({ month })
            .toMillis();

        if (textOptions.has(STATUS_OPTION)) {
            const status = textOptions.get(STATUS_OPTION);
            if (!(await this.taskTracker.hasStatusInProject(projectKey, status))) {
                logger.warn(`Command archiveproject was made with incorrect option arg ${status}`);

                return translate('notValid', { body: status });
            }

            await setArchiveProject(projectKey, { keepTimestamp, status });

            return translate('successProjectAddToArchiveWithStatus', { projectKey, activeTime: month, status });
        }

        await setArchiveProject(projectKey, { keepTimestamp });

        return translate('successProjectAddToArchive', { projectKey, activeTime: month });
    }
}
