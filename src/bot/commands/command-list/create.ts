import marked from 'marked';
import { translate } from '../../../locales';
import * as utils from '../../../lib/utils';
import { getLogger } from '../../../modules/log';
import { CommandOptions } from '../../../types';
import { Command, RunCommand } from './command-base';
import { Jira } from '../../../task-trackers/jira';

const logger = getLogger(module);

export class CreateCommand extends Command<Jira> implements RunCommand {
    async run({ bodyText = '', roomName }: CommandOptions) {
        if (!roomName) {
            throw new Error('Not issue room');
        }

        try {
            const [issueType, ...wordsNameNewIssue] = bodyText.split(' ');
            const summary = wordsNameNewIssue.join(' ');
            const projectKey = utils.getProjectKeyFromIssueKey(roomName);
            const { id: projectId, issueTypes, style: styleProject } = await this.taskTracker.getProject(projectKey);
            const namesIssueTypeInProject = issueTypes.map(({ name }) => name);

            // check characters from command
            if (!bodyText || !issueType || !namesIssueTypeInProject.includes(issueType)) {
                return utils.ignoreKeysInProject(projectKey, namesIssueTypeInProject);
            }
            if (!summary) {
                return translate('issueNameExist');
            }
            if (summary.length > 255 || summary.includes('\n')) {
                return translate('issueNameTooLong');
            }
            const type = issueTypes.find(el => (el.name = issueType))!;
            const issue = await this.taskTracker.getIssue(roomName);
            const isEpic = this.taskTracker.selectors.isEpic({ issue });
            if (isEpic && type?.subtask) {
                return translate('epicShouldNotHaveSubtask');
            }

            // create issue, for sub-task and epic next-gen also will be created link
            const { key: newIssueKey } = await this.taskTracker.createIssue({
                summary,
                issueTypeId: type.id,
                projectId,
                parentId: roomName,
                isEpic,
                isSubtask: type?.subtask,
                styleProject,
            });
            if (!isEpic && !type?.subtask) {
                await this.taskTracker.createIssueLink(newIssueKey, roomName);
                return;
            }
            if (styleProject === 'classic' && isEpic) {
                await this.taskTracker.createEpicLinkClassic(newIssueKey, roomName);
                return;
            }
            const viewUrl = this.taskTracker.getViewUrl(newIssueKey);

            return marked(translate('newTaskWasCreated', { summary, newIssueKey, viewUrl }));
        } catch (err) {
            logger.error(err);
        }
    }
}
