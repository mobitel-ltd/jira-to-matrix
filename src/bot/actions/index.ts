import { Config, TaskTracker, ActionNames } from '../../types';
import { ChatFasade } from '../../messengers/chat-fasade';

import { CreateRoom } from './create-room';
import { InviteNewMembers } from './invite-new-members';
import { PostComment } from './post-comment';
import { PostIssueUpdates } from './post-issue-updates';
import { PostEpicUpdates } from './post-epic-updates';
import { PostProjectUpdates } from './post-project-updates';
import { PostNewLinks } from './post-new-links';
import { PostLinkedChanges } from './post-linked-changes';
import { PostLinkDeleted } from './post-link-deleted';
import { ArchiveProject } from './archive-project';
// import { Jira } from '../../task-trackers/jira';
import { Upload } from './upload';
// import { Gitlab } from '../../task-trackers/gitlab';
import { PostCommit } from './post-commit';
import { PostPipeline } from './post-pipeline';
import { PostMilestoneUpdates } from './post-milestone-updates';

export class Actions {
    commandsDict;

    constructor(private config: Config, private taskTracker: TaskTracker, private chatApi: ChatFasade) {
        const commonActions = {
            [ActionNames.CreateRoom]: CreateRoom,
            [ActionNames.InviteNewMembers]: InviteNewMembers,
            [ActionNames.PostComment]: PostComment,
            [ActionNames.PostProjectUpdates]: PostProjectUpdates,
            [ActionNames.PostIssueUpdates]: PostIssueUpdates,
        };

        const jiraActions = {
            [ActionNames.PostEpicUpdates]: PostEpicUpdates,
            [ActionNames.ArchiveProject]: ArchiveProject,
            [ActionNames.PostLinkedChanges]: PostLinkedChanges,
            [ActionNames.PostLinksDeleted]: PostLinkDeleted,
            [ActionNames.PostNewLinks]: PostNewLinks,
        };

        const gitlabActions = {
            [ActionNames.Upload]: Upload,
            [ActionNames.PostCommit]: PostCommit,
            [ActionNames.Pipeline]: PostPipeline,
            [ActionNames.PostMilestoneUpdates]: PostMilestoneUpdates,
        };

        const trackerActions = config.taskTracker.type === 'gitlab' ? gitlabActions : jiraActions;

        this.commandsDict = { ...commonActions, ...trackerActions };
    }

    async run(commandName: ActionNames, commandOptions: any): Promise<boolean | string[] | undefined | string> {
        const Command = this.commandsDict[commandName];

        if (Command) {
            const command = new Command(this.config, this.taskTracker, this.chatApi);

            return await command.run(commandOptions);
        }
    }
}
