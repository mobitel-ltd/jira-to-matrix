import * as fs from 'fs';
import * as path from 'path';
import * as marked from 'marked';
import { translate } from '../../../locales';
import { getLogger } from '../../../modules/log';

const logger = getLogger(module);

export const help = ({ bodyText, config, chatApi, roomData }) => {
    if (chatApi.getCommandRoomName() === roomData.alias) {
        if (!chatApi.isMaster()) {
            logger.warn('Skip operation for not master bot');

            return;
        }
    }

    const linkFullHelp = `${config.pathToDocs}/${config.lang}/commands/help.md`;

    if (!bodyText) {
        return translate('helpDocs', { link: linkFullHelp, text: '' });
    }

    // load all MD files, depends from locals
    const pathBase = path.resolve('.', 'docs', config.lang, 'commands');
    const content = fs
        .readdirSync(pathBase)
        .filter(fileName => 'help.md' !== fileName)
        .map(path.parse)
        .map(({ base, name }) => {
            const textHelp = fs.readFileSync(path.resolve(pathBase, base), 'utf8');
            return { textHelp, name };
        });
    const allHelpCommands = content.reduce((acc, command) => {
        const { name, textHelp } = command;
        return { ...acc, [name]: textHelp };
    }, {});
    //

    const { [bodyText]: helpTextCommand } = allHelpCommands;
    if (!helpTextCommand) {
        return translate('helpDocsCommandNotExist', { link: linkFullHelp, command: bodyText });
    }
    const linkDocsCommand = `${config.pathToDocs}/${config.lang}/commands/${bodyText}.md`;

    return translate('helpDocs', { link: linkDocsCommand, text: marked(helpTextCommand) });
};
