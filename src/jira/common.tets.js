const {webHookUser} = require('./common');

// eslint-disable-next-line 
test('Extract username from JIRA webhook', () => {
    const samples = [
        [{
            comment: {author: {name: 'user1'}},
            user: {name: 'user2'},
        }, 'user1'],
        [{
            user: {name: 'user2'},
        }, 'user2'],
        [{
            comment: {author1: {name: 'user1'}},
            user: {name1: 'user2'},
        }, undefined],
        [{comment: {}}, undefined],
        [{}, undefined],
    ];
    samples.forEach(sample => {
        const result = webHookUser(sample[0]);
        expect(result).toBe(sample[1]); // eslint-disable-line no-undef
    });
});
