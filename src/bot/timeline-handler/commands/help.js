const marked = require('marked');
const { pathToDocs, lang } = require('../../../config');
const translate = require('../../../locales');
const helpCommand = require(`../../../../docs/${lang}/commands`);

module.exports = ({ bodyText }) => {
    const linkFullHelp = `${pathToDocs}/${lang}/commands/help.md`;

    if (!bodyText) {
        return translate('helpDocs', { link: linkFullHelp, text: '' });
    }
    const { [bodyText]: helpTextCommand } = helpCommand;
    if (!helpTextCommand) {
        return translate('helpDocsCommandNotExist', { link: linkFullHelp, command: bodyText });
    }
    const linkDocsCommand = `${pathToDocs}/${lang}/commands/${bodyText}.md`;
    return translate('helpDocs', { link: linkDocsCommand, text: marked(helpTextCommand) });
};
