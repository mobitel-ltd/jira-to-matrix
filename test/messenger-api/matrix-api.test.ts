import * as chai from 'chai';
import { MatrixApi, Msgtype } from '../../src/messengers/matrix-api';
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
            const res = matrix.parseEventBody({ body, msgtype: Msgtype.text });
            expect(res?.commandName).to.be.equal('help');
            expect(res?.bodyText).to.be.undefined;
        });

        it('correct command name', () => {
            const body = '!help   ';
            const res = matrix.parseEventBody({ body, msgtype: Msgtype.text });
            expect(res?.commandName).to.be.equal('help');
            expect(res?.bodyText).to.be.undefined;
        });

        it('correct command name', () => {
            const body = '!op gogogogo';
            const res = matrix.parseEventBody({ body, msgtype: Msgtype.text });
            expect(res?.commandName).to.be.equal('op');
            expect(res?.bodyText).to.be.equal('gogogogo');
        });

        it('correct command long body args', () => {
            const command = 'op';
            const commandOptions = '--option optionParam';
            const body = `!${command}   ${commandOptions}`;
            const res = matrix.parseEventBody({ body, msgtype: Msgtype.text });
            expect(res?.commandName).to.be.equal(command);
            expect(res?.bodyText).to.be.equal(commandOptions);
        });

        it('false command name', () => {
            const body = CommandNames.Help;
            const res = matrix.parseEventBody({ body, msgtype: Msgtype.text });
            expect(res?.commandName).not.to.be;
            expect(res?.bodyText).to.be.eq(body);
        });

        it('false command name', () => {
            const body = '!!help';
            const res = matrix.parseEventBody({ body, msgtype: Msgtype.text });
            expect(res?.commandName).not.to.be;
            expect(res?.bodyText).not.to.be;
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
            const res = matrix.parseEventBody({ body, msgtype: Msgtype.text });
            expect(res?.commandName).to.be.eq(CommandNames.Comment);
            expect(res?.bodyText).to.be.eq(body);
        });

        it('correct command name', () => {
            const body = matrix.createCommand(CommandNames.Help);
            const res = matrix.parseEventBody({ body, msgtype: Msgtype.text });
            expect(res?.commandName).to.be.eq(CommandNames.Help);
            expect(res?.bodyText).to.be.undefined;
        });

        it('correct command name', () => {
            const body = matrix.createCommand(CommandNames.Help) + ' lalalla';
            const res = matrix.parseEventBody({ body, msgtype: Msgtype.text });
            expect(res?.commandName).to.be.eq(CommandNames.Help);
            expect(res?.bodyText).to.be.eq('lalalla');
        });
    });
});
