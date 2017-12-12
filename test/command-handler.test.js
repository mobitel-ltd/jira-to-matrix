const assert = require('assert');
const logger = require('../src/modules/log.js')(module);

const {parseBody} = require('../src/matrix/timeline-handler/checker.js');

describe('command handler test', () => {
    const expected = 'help';
    it('correct command name', () => {
        const body = '!help';
        const {commandName} = parseBody(body);
        assert.equal(commandName, expected);
    });

    it('correct command name', () => {
        const body = '!op gogogogo';
        const result = parseBody(body);
        assert.deepEqual(result, {commandName: 'op', bodyText: 'gogogogo'});
    });

    it('correct command name', () => {
        const body = 'help';
        const result = parseBody(body);
        assert.equal(result, null);
    });
});
