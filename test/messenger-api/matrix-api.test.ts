import * as chai from 'chai';
import { MatrixApi } from '../../src/messengers/matrix-api';
import { Commands } from '../../src/bot/commands';
import { getLogger } from '../../src/modules/log';
import { config } from '../../src/config';
import { ChatConfig, CommandNames } from '../../src/types';
import { createSinonStubInstance } from '../test-utils';
const { expect } = chai;

describe('command handler test', () => {
    describe('simple post comment', () => {
        const commands = createSinonStubInstance(Commands);
        const chatConfig: ChatConfig = { ...config, ...config.messenger.bots[0] };
        const matrix = new MatrixApi(commands, chatConfig, getLogger('matrix'), {});

        it('correct command name', () => {
            const body = '!help';
            const { commandName, bodyText } = matrix.parseEventBody(body);
            expect(commandName).to.be.equal('help');
            expect(bodyText).to.be.undefined;
        });

        it('correct command name', () => {
            const body = '!help   ';
            const { commandName, bodyText } = matrix.parseEventBody(body);
            expect(commandName).to.be.equal('help');
            expect(bodyText).to.be.undefined;
        });

        it('correct command name', () => {
            const body = '!op gogogogo';
            const { commandName, bodyText } = matrix.parseEventBody(body);
            expect(commandName).to.be.equal('op');
            expect(bodyText).to.be.equal('gogogogo');
        });

        it('correct command long body args', () => {
            const command = 'op';
            const commandOptions = '--option optionParam';
            const body = `!${command}   ${commandOptions}`;
            const { commandName, bodyText } = matrix.parseEventBody(body);
            expect(commandName).to.be.equal(command);
            expect(bodyText).to.be.equal(commandOptions);
        });

        it('false command name', () => {
            const body = CommandNames.Help;
            const { commandName, bodyText } = matrix.parseEventBody(body);
            expect(commandName).not.to.be;
            expect(bodyText).to.be.eq(body);
        });

        it('false command name', () => {
            const body = '!!help';
            const { commandName, bodyText } = matrix.parseEventBody(body);
            expect(commandName).not.to.be;
            expect(bodyText).not.to.be;
        });
    });

    describe('post each comment', () => {
        const commands = createSinonStubInstance(Commands);
        const chatConfig: ChatConfig = {
            ...config,
            ...config.messenger.bots[0],
            features: { ...config.features, postEachComments: true },
        };
        const matrix = new MatrixApi(commands, chatConfig, getLogger('matrix'), {});

        it('should return command comment and body even if no command was made', () => {
            const body = CommandNames.Help;
            const { commandName, bodyText } = matrix.parseEventBody(body);
            expect(commandName).to.be.eq(CommandNames.Comment);
            expect(bodyText).to.be.eq(body);
        });

        it('correct command name', () => {
            const body = matrix.createCommand(CommandNames.Help);
            const { commandName, bodyText } = matrix.parseEventBody(body);
            expect(commandName).to.be.eq(CommandNames.Help);
            expect(bodyText).to.be.undefined;
        });

        it('correct command name', () => {
            const body = matrix.createCommand(CommandNames.Help) + ' lalalla';
            const { commandName, bodyText } = matrix.parseEventBody(body);
            expect(commandName).to.be.eq(CommandNames.Help);
            expect(bodyText).to.be.eq('lalalla');
        });
    });
});
