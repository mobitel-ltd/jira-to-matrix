import { Config, TaskTracker, ActionNames } from '../../types';
import { ChatFasade } from '../../messengers/chat-fasade';
import { RunAction } from './base-action';

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
import { Jira } from '../../task-trackers/jira';
import { Upload } from './upload';
import { Gitlab } from '../../task-trackers/gitlab';

export class Actions {
    commandsDict: Record<ActionNames, RunAction>;

    constructor(private config: Config, private taskTracker: TaskTracker, private chatApi: ChatFasade) {
        this.commandsDict = {
            [ActionNames.CreateRoom]: new CreateRoom(config, taskTracker, chatApi.worker),
            [ActionNames.InviteNewMembers]: new InviteNewMembers(config, taskTracker, chatApi),
            [ActionNames.PostComment]: new PostComment(config, taskTracker, chatApi),
            [ActionNames.PostProjectUpdates]: new PostProjectUpdates(config, taskTracker, chatApi),
            // JIRA ONLY
            [ActionNames.PostEpicUpdates]: new PostEpicUpdates(config, taskTracker as Jira, chatApi),
            [ActionNames.ArchiveProject]: new ArchiveProject(config, taskTracker as Jira, chatApi),
            [ActionNames.PostIssueUpdates]: new PostIssueUpdates(config, taskTracker as Jira, chatApi),
            [ActionNames.PostLinkedChanges]: new PostLinkedChanges(config, taskTracker as Jira, chatApi),
            [ActionNames.PostLinksDeleted]: new PostLinkDeleted(config, taskTracker as Jira, chatApi),
            [ActionNames.PostNewLinks]: new PostNewLinks(config, taskTracker as Jira, chatApi),
            // Gitlab only
            [ActionNames.Upload]: new Upload(config, taskTracker as Gitlab, chatApi),
        };
    }

    async run(commandName: ActionNames, commandOptions: any): Promise<boolean | string[] | undefined> {
        const command: RunAction | undefined = this.commandsDict[commandName];

        if (command) {
            return await command.run(commandOptions);
        }
    }
}
