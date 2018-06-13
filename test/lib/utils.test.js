/* eslint-disable no-undefined */
const {isIgnoreKey, webHookUser, getCreator, auth, getChangelogField, paramsToQueryString, propIn, nonEmptyString, paths, getNewStatus} = require('../../src/lib/utils');
const assert = require('assert');
const hook = require('../fixtures/comment-create-2.json');
const thirdBody = require('../fixtures/comment-create-3.json');
const {expect} = require('chai');
const body = require('../fixtures/comment-create-4.json');

describe('Utils testing', () => {
    const expectedFuncKeys = [
        'test-jira-hooks:postEpicUpdates_2018-1-11 13:08:04,225',
    ];

    it('test isIgnoreKey', () => {
        const keys = [
            'test-jira-hooks:postEpicUpdates_2018-1-11 13:08:04,225',
            'test-jira-hooks:rooms',
            'test-jira-hooks:newrooms',
        ];
        const result = keys.filter(isIgnoreKey);
        expect(result).to.be.deep.equal(expectedFuncKeys);
    });

    it('Prop in an array', () => {
        const samples = [
            ['prop', [1, 2], {prop: 1}, true],
            ['prop', [undefined, 2], {prop: undefined}, true],
            ['prop', [1, 2], {prop: 3}, false],
            ['prop', [1, 2], {prop1: 1}, false],
            ['prop', [1, 2], undefined, false],
            ['prop', [1, 2], {}, false],
            ['prop', [1, 2], {prop: undefined}, false],
            ['prop', [1, 2], {prop: null}, false],
        ];
        samples.forEach(sample => {
            const fn1 = propIn(sample[0]);
            const fn = fn1(sample[1]);
            const result = fn(sample[2]);
            assert.deepEqual(result, sample[3]);
        });
    });

    it('Key/value pairs to URL query string', () => {
        const samples = [
            {input: [{par1: 10}, {par2: 20}], result: '?par1=10&par2=20'},
            {input: '', result: ''},
            {input: undefined, result: ''},
            {input: null, result: ''},
            {input: [], result: ''},
            {input: {}, result: ''},
        ];
        samples.forEach(sample => {
            const result = paramsToQueryString(sample.input);
            assert.deepEqual(result, sample.result);
        });
    });

    it('None-empty string', () => {
        const samples = [
            ['aaa', true],
            ['', false],
            [null, false],
            [undefined, false],
            [{prop: 1}, false],
            [[], false],
        ];
        samples.forEach(sample => {
            const result = nonEmptyString(sample[0]);
            assert.deepEqual(result, sample[1]);
        });
    });

    it('Paths', () => {
        const result = paths([
            'user.name',
            'issue.key',
            'issue.fields.summary',
        ], hook);
        const expected = {
            'user.name': 'jira_test',
            'issue.key': 'BBCOM-956',
            'issue.fields.summary': 'BBCOM-956',
        };

        assert.deepEqual(result, expected);
    });

    it('getNewStatus', () => {
        const status = getNewStatus(thirdBody);
        assert.equal(status, 'Closed');
    });
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
            toString: 'Paused',
        };

        expect(changelogField).to.be.deep.equal(expected);
    });

    it('Test unexpected getChangelogField', () => {
        const changelogField = getChangelogField('fake', body);

        expect(changelogField).to.be.undefined;
    });
});
