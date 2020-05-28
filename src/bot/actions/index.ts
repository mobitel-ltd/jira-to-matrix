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

export const getActionsDict = (
    config: Config,
    taskTracker: TaskTracker,
    chatApi: ChatFasade,
): Record<ActionNames, RunAction> => ({
    [ActionNames.CreateRoom]: new CreateRoom(config, taskTracker, chatApi.worker),
    [ActionNames.ArchiveProject]: new ArchiveProject(config, taskTracker, chatApi),
    [ActionNames.InviteNewMembers]: new InviteNewMembers(config, taskTracker, chatApi),
    [ActionNames.PostComment]: new PostComment(config, taskTracker, chatApi),
    [ActionNames.PostEpicUpdates]: new PostEpicUpdates(config, taskTracker, chatApi),
    [ActionNames.PostIssueUpdates]: new PostIssueUpdates(config, taskTracker, chatApi),
    [ActionNames.PostLinkedChanges]: new PostLinkedChanges(config, taskTracker, chatApi),
    [ActionNames.PostLinksDeleted]: new PostLinkDeleted(config, taskTracker, chatApi),
    [ActionNames.PostNewLinks]: new PostNewLinks(config, taskTracker, chatApi),
    [ActionNames.PostProjectUpdates]: new PostProjectUpdates(config, taskTracker, chatApi),
});
