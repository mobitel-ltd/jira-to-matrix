const assert = require('assert');

const {parseEventBody} = require('../src/matrix/timeline-handler/commands/helper.js');

describe('command handler test', () => {
    it('correct command name', () => {
        const body = '!help';
        const {commandName, bodyText} = parseEventBody(body);
        assert.equal(commandName, 'help');
        assert.equal(bodyText, '');
    });

    it('correct command name', () => {
        const body = '!op gogogogo';
        const {commandName, bodyText} = parseEventBody(body);
        assert.equal(commandName, 'op');
        assert.equal(bodyText, 'gogogogo');
    });

    it('false command name', () => {
        const body = 'help';
        const {commandName, bodyText} = parseEventBody(body);
        assert.equal(commandName, null);
    });

    it('false command name', () => {
        const body = '!!help';
        const {commandName, bodyText} = parseEventBody(body);
        assert.equal(commandName, null);
        assert.equal(bodyText, null);
    });
});
