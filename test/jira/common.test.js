const {webHookUser, getCreator, auth, getChangelogField} = require('../../src/jira/common');
const {expect} = require('chai');
const body = require('../fixtures/comment-create-4.json');

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
            expect(result).to.be.equal(sample[1]);
        });
    });

    it('Extract creator name from JIRA webhook', () => {
        const creator = getCreator(body);

        expect(creator).to.be.equal('jira_test');
    });

    it('Test correct auth', () => {
        const currentAuth = auth();

        expect(currentAuth).to.be.equal('Basic amlyYV90ZXN0X2JvdDpmYWtlcGFzc3dwcmQ=');
    });

    it('Test correct getChangelogField', () => {
        const changelogField = getChangelogField('status', body);
        const expected = {
            field: 'status',
            fieldtype: 'jira',
            from: '3',
            fromString: 'In progress',
            to: '10602',
            toString: 'Paused'
        };

        expect(changelogField).to.be.deep.equal(expected);
    });

    it('Test unexpected getChangelogField', () => {
        const changelogField = getChangelogField('fake', body);

        expect(changelogField).to.be.undefined;
    });
});
