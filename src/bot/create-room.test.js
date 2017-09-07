const {shouldCreateRoom} = require('./create-room').forTests;

// eslint-disable-next-line no-undef
test('Should create room on webhook or not', () => {
    const samples = [
        [{webhookEvent: 'jira:issue_created', issue: {}}, true],
        [{webhookEvent: 'jira:issue_updated', issue: {}}, false],
        [{webhookEvent: 'jira:issue_created'}, false],
        [{}, false],
        [undefined, false],
    ];
    samples.forEach(sample => {
        const result = shouldCreateRoom(sample[0]);
        expect(result).toBe(sample[1]); // eslint-disable-line no-undef
    });
});
