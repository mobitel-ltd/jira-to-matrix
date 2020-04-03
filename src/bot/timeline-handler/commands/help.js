const marked = require('marked');
const translate = require('../../../locales');
const ruHelp = require('../../../../docs/ru/commands');
const enHelp = require('../../../../docs/en/commands');

const getLocally = lang => {
    const map = {
        ru: ruHelp,
        en: enHelp,
    };

    return map[lang];
};

module.exports = ({ bodyText, config }) => {
    const linkFullHelp = `${config.pathToDocs}/${config.lang}/commands/help.md`;

    if (!bodyText) {
        return translate('helpDocs', { link: linkFullHelp, text: '' });
    }
    const { [bodyText]: helpTextCommand } = getLocally(config.lang);
    if (!helpTextCommand) {
        return translate('helpDocsCommandNotExist', { link: linkFullHelp, command: bodyText });
    }
    const linkDocsCommand = `${config.pathToDocs}/${config.lang}/commands/${bodyText}.md`;

    return translate('helpDocs', { link: linkDocsCommand, text: marked(helpTextCommand) });
};
