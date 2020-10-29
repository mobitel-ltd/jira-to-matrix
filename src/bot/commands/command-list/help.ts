import * as fs from 'fs';
import * as path from 'path';
import marked from 'marked';
import { translate } from '../../../locales';
import { getLogger } from '../../../modules/log';
import { CommandOptions, TaskTracker } from '../../../types';
import { Command, RunCommand } from './command-base';

const logger = getLogger(module);

export class HelpCommand extends Command<TaskTracker> implements RunCommand {
    async run({ bodyText, roomData }: CommandOptions) {
        if (this.chatApi.getCommandRoomName() === roomData.alias) {
            if (!this.chatApi.isMaster()) {
                logger.warn('Skip operation for not master bot');

                return;
            }
        }

        const linkFullHelp = `${this.config.pathToDocs}/${this.config.lang}/commands/help.md`;

        if (!bodyText) {
            return translate('helpDocs', { link: linkFullHelp, text: '' });
        }

        // load all MD files, depends from locals
        const pathBase = path.resolve('.', 'docs', this.config.lang, 'commands');
        const content = fs
            .readdirSync(pathBase)
            .filter(fileName => 'help.md' !== fileName)
            .map(path.parse)
            .map(({ base, name }) => {
                const textHelp = fs.readFileSync(path.resolve(pathBase, base), 'utf8');
                return { textHelp, name };
            });
        const allHelpCommands: Record<string, string> = content.reduce((acc, command) => {
            const { name, textHelp } = command;
            return { ...acc, [name]: textHelp };
        }, {});
        //

        const { [bodyText]: helpTextCommand } = allHelpCommands;
        if (!helpTextCommand) {
            return translate('helpDocsCommandNotExist', { link: linkFullHelp, command: bodyText });
        }
        const linkDocsCommand = `${this.config.pathToDocs}/${this.config.lang}/commands/${bodyText}.md`;

        return translate('helpDocs', { link: linkDocsCommand, text: marked(helpTextCommand) });
    }
}
