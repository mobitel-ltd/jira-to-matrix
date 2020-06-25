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
            expect(res).to.be.deep.equal({
                isSuccess: true,
                body: { commandName: CommandNames.Help },
            });
        });

        it('correct command name', () => {
            const body = '!help   ';
            const res = matrix.parseEventBody({ body, msgtype: Msgtype.text });
            expect(res).to.be.deep.equal({
                isSuccess: true,
                body: { commandName: 'help' },
            });
        });

        it('correct command name', () => {
            const body = '!op gogogogo';
            const res = matrix.parseEventBody({ body, msgtype: Msgtype.text });
            expect(res).to.be.deep.equal({
                isSuccess: true,
                body: { commandName: 'op', bodyText: 'gogogogo' },
            });
        });

        it('correct command long body args', () => {
            const command = 'op';
            const commandOptions = '--option optionParam';
            const body = `!${command}   ${commandOptions}`;
            const res = matrix.parseEventBody({ body, msgtype: Msgtype.text });
            expect(res).to.be.deep.equal({
                isSuccess: true,
                body: { commandName: command, bodyText: commandOptions },
            });
        });

        it('false command name', () => {
            const body = CommandNames.Help;
            const res = matrix.parseEventBody({ body, msgtype: Msgtype.text });
            expect(res).to.be.deep.equal({
                isSuccess: false,
            });
        });

        it('false command name', () => {
            const body = '!!help';
            const res = matrix.parseEventBody({ body, msgtype: Msgtype.text });
            expect(res).to.be.deep.equal({
                isSuccess: false,
            });
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
            expect(res).to.be.deep.equal({
                isSuccess: true,
                body: { commandName: CommandNames.Comment, bodyText: body },
            });
        });

        it('correct command name', () => {
            const body = matrix.createCommand(CommandNames.Help);
            const res = matrix.parseEventBody({ body, msgtype: Msgtype.text });
            expect(res).to.be.deep.equal({
                isSuccess: true,
                body: { commandName: CommandNames.Help },
            });
        });

        it('correct command name', () => {
            const body = matrix.createCommand(CommandNames.Help) + ' lalalla';
            const res = matrix.parseEventBody({ body, msgtype: Msgtype.text });
            expect(res).to.be.deep.equal({
                isSuccess: true,
                body: { commandName: CommandNames.Help, bodyText: 'lalalla' },
            });
        });
    });
});
