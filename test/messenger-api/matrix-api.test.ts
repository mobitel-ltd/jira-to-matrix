import * as chai from 'chai';
import { MatrixApi } from '../../src/messengers/matrix-api';
const { expect } = chai;

describe('command handler test', () => {
    it('correct command name', () => {
        const body = '!help';
        const { commandName, bodyText } = MatrixApi.parseEventBody(body);
        expect(commandName).to.be.equal('help');
        expect(bodyText).to.be.undefined;
    });

    it('correct command name', () => {
        const body = '!help   ';
        const { commandName, bodyText } = MatrixApi.parseEventBody(body);
        expect(commandName).to.be.equal('help');
        expect(bodyText).to.be.undefined;
    });

    it('correct command name', () => {
        const body = '!op gogogogo';
        const { commandName, bodyText } = MatrixApi.parseEventBody(body);
        expect(commandName).to.be.equal('op');
        expect(bodyText).to.be.equal('gogogogo');
    });

    it('correct command long body args', () => {
        const command = 'op';
        const commandOptions = '--option optionParam';
        const body = `!${command}   ${commandOptions}`;
        const { commandName, bodyText } = MatrixApi.parseEventBody(body);
        expect(commandName).to.be.equal(command);
        expect(bodyText).to.be.equal(commandOptions);
    });

    it('false command name', () => {
        const body = 'help';
        const { commandName } = MatrixApi.parseEventBody(body);
        expect(commandName).not.to.be;
    });

    it('false command name', () => {
        const body = '!!help';
        const { commandName, bodyText } = MatrixApi.parseEventBody(body);
        expect(commandName).not.to.be;
        expect(bodyText).not.to.be;
    });
});
