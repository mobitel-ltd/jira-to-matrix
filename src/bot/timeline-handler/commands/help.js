const { pathToDocs, lang } = require('../../../config');
const helpCommand = require('./index');

module.exports = ({ bodyText }) => {
    if (!bodyText) {
        return `${pathToDocs}/${lang}/commands/help.md`;
    }
    const { [bodyText]: helpTextCommand } = helpCommand;
    if (!helpTextCommand) {
        return `Such command - ${bodyText} not exist`;
    }

    return `${pathToDocs}/${lang}/commands/help.md#${bodyText}`;
};
