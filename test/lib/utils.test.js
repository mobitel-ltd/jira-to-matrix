/* eslint-disable no-undefined */
const utils = require('../../src/lib/utils');
const assert = require('assert');
const issueChangedHook = require('../fixtures/webhooks/issue/updated/commented-changed.json');
const {expect} = require('chai');
const body = require('../fixtures/webhooks/issue/updated/generic.json');
const issueUpdatedGenericHook = require('../fixtures/webhooks/issue/updated/generic.json');
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
        const result = keys.filter(utils.isIgnoreKey);
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
            const fn1 = utils.propIn(sample[0]);
            const fn = fn1(sample[1]);
            const result = fn(sample[2]);
            assert.deepEqual(result, sample[3]);
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
            const result = utils.nonEmptyString(sample[0]);
            assert.deepEqual(result, sample[1]);
        });
    });

    it('getNewStatus', () => {
        const status = utils.getNewStatus(issueChangedHook);
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
            const result = utils.getHookUserName(sample[0]);
            expect(result).to.be.equal(sample[1]);
        });
    });

    it('Extract creator name from JIRA webhook', () => {
        const creator = utils.getCreator(body);

        expect(creator).to.be.equal('jira_test');
    });

    it('Test correct auth', () => {
        const currentAuth = utils.auth();

        expect(currentAuth).to.be.equal('Basic amlyYV90ZXN0X2JvdDpmYWtlcGFzc3dwcmQ=');
    });

    it('Test correct getChangelogField', () => {
        const changelogField = utils.getChangelogField('status', body);
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
        const changelogField = utils.getChangelogField('fake', body);

        expect(changelogField).to.be.undefined;
    });

    it('Expect getComment return undefined', () => {
        const body = utils.getComment(issueUpdatedGenericHook);
        expect(body).to.be.undefined;
    });

    it('getChatUserId test', () => {
        const name = 'SOMENAME';
        const result = utils.getChatUserId(name);

        expect(result).to.equal(`@${name.toLowerCase()}:matrix.test-example.ru`);
    });

    it('Expect getLimit to be timestamp of 01.01.2018', () => {
        const limit = utils.getLimit();
        const expected = 1514775600000;

        expect(limit).to.be.equal(expected);
    });

    it('Expect runMethod don\'t throw with unknown type', () => {
        const res = utils.runMethod({}, 'getCreator');

        expect(res).to.be.undefined;
    });
});
