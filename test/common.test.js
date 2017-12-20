const {webHookUser} = require('../src/jira/common');
const assert = require('assert');

describe('isCreateRoom', () => {
    it('Extract username from JIRA webhook', () => {
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
            assert.equal(result, sample[1]);
        });
    });
});
