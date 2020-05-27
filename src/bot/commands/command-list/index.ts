import { CommentCommand } from './comment';
import { AssignCommand } from './assign';
import { MoveCommand } from './move';
import { SpecCommand } from './speci';
import { PrioCommand } from './prio';
import { OpCommand } from './op';
import { InviteCommand } from './invite';
import { HelpCommand } from './help';
import { IgnoreCommand } from './ignore';
import { CreateCommand } from './create';
import { AutoInviteCommand } from './autoinvite';
import { AliveCommand } from './alive';
import { GetInfoCommand } from './getInfo';
import { KickCommand } from './kick';
import { ArchiveCommand } from './archive';
import { ProjectArchiveCommand } from './archive-project';

import { Config, TaskTracker, MessengerApi, CommandNames } from '../../../types';
import { RunCommand } from './command-base';

export const getCommandDict = (
    config: Config,
    taskTracker: TaskTracker,
    chatApi: MessengerApi,
): Record<CommandNames, RunCommand> => ({
    [CommandNames.Comment]: new CommentCommand(config, taskTracker, chatApi),
    [CommandNames.Assign]: new AssignCommand(config, taskTracker, chatApi),
    [CommandNames.Move]: new MoveCommand(config, taskTracker, chatApi),
    [CommandNames.Spec]: new SpecCommand(config, taskTracker, chatApi),
    [CommandNames.Prio]: new PrioCommand(config, taskTracker, chatApi),
    [CommandNames.Op]: new OpCommand(config, taskTracker, chatApi),
    [CommandNames.Invite]: new InviteCommand(config, taskTracker, chatApi),
    [CommandNames.Help]: new HelpCommand(config, taskTracker, chatApi),
    [CommandNames.Ignore]: new IgnoreCommand(config, taskTracker, chatApi),
    [CommandNames.Create]: new CreateCommand(config, taskTracker, chatApi),
    [CommandNames.Autoinvite]: new AutoInviteCommand(config, taskTracker, chatApi),
    [CommandNames.Alive]: new AliveCommand(config, taskTracker, chatApi),
    [CommandNames.GetInfo]: new GetInfoCommand(config, taskTracker, chatApi),
    [CommandNames.Kick]: new KickCommand(config, taskTracker, chatApi),
    [CommandNames.Archive]: new ArchiveCommand(config, taskTracker, chatApi),
    [CommandNames.Projectarchive]: new ProjectArchiveCommand(config, taskTracker, chatApi),
});
