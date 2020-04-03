const fs = require('fs');
const path = require('path');
const marked = require('marked');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);
const translate = require('../../src/locales');
const testUtils = require('../test-utils');

const commandHandler = require('../../src/bot/timeline-handler');

describe('comment help', () => {
    let chatApi;
    let baseOptions;
    const roomName = 'BBCOM-123';
    const bodyText = 'text in body';
    const sender = 'user';
    const roomId = 12345;
    const commandName = 'help';
    const config = { pathToDocs: 'http://example.com', lang: 'en' };

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

    beforeEach(() => {
        chatApi = testUtils.getChatApi();
        baseOptions = { roomId, roomName, commandName, sender, chatApi, bodyText, config };
    });

    it('Expect comment only command help', async () => {
        const post = translate('helpDocs', { link: 'http://example.com/en/commands/help.md', text: '' });
        const result = await commandHandler({ ...baseOptions, bodyText: '' });
        expect(result).to.be.eq(post);
    });
    it('Expect comment command op', async () => {
        const post = translate('helpDocs', {
            link: 'http://example.com/en/commands/op.md',
            text: marked(allHelpCommands.op),
        });
        const result = await commandHandler({ ...baseOptions, bodyText: 'op' });
        expect(result).to.be.eq(post);
    });
    it('Expect comment command lalala', async () => {
        const post = translate('helpDocsCommandNotExist', {
            link: 'http://example.com/en/commands/help.md',
            command: 'lalala',
        });
        const result = await commandHandler({ ...baseOptions, bodyText: 'lalala' });
        expect(result).to.be.eq(post);
    });
});
