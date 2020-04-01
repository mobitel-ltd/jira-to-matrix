const fs = require('fs');
const path = require('path');
const { lang } = require('../../../config');

const pathBase = path.resolve('.', 'docs', lang, 'commands');
const content = fs
    .readdirSync(pathBase)
    .filter(fileName => !['help.md', 'index.js'].includes(fileName))
    .map(path.parse)
    .map(({ base, name }) => {
        const textHelp = fs.readFileSync(path.resolve(pathBase, base), 'utf8');
        return { textHelp, name };
    });
const result = content.reduce((acc, command) => {
    const { name, textHelp } = command;
    return { ...acc, [name]: textHelp };
}, {});

module.exports = result;
