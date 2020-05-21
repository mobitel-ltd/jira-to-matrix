import * as fs from 'fs';
import * as path from 'path';
import marked from 'marked';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
const { expect } = chai;
chai.use(sinonChai);
import { translate } from '../../src/locales';
const testUtils from '../test-utils');

const commandHandler from '../../src/bot/commands');

describe('comment help', () => {
    let chatApi;
    let baseOptions;
    const roomData = {
        alias: 'BBCOM-123',
        id: 12345,
    };
    const bodyText = 'text in body';
    const sender = 'user';
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
        chatApi = testUtils.getChatClass();
        baseOptions = { roomData, commandName, sender, chatApi, bodyText, config };
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

    describe('Command room', () => {
        beforeEach(() => {
            chatSingle.getCommandRoomName = () => roomData.alias;
        });

        it('Expect help NOT works if bot is not master', async () => {
            expect(await commandHandler(baseOptions)).to.be.undefined;
        });

        it('Expect help works if bot is master', async () => {
            chatSingle.isMaster = () => true;
            const post = translate('helpDocs', { link: 'http://example.com/en/commands/help.md', text: '' });
            const result = await commandHandler({ ...baseOptions, bodyText: '' });
            expect(result).to.be.eq(post);
        });
    });
});
