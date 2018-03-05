const {paramsToQueryString, fp} = require('../src/utils');
const assert = require('assert');
const hook = require('./fixtures/comment-create-2.json');

describe('paramsToQueryString', () => {
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
            const fn1 = fp.propIn(sample[0]);
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
            const result = fp.nonEmptyString(sample[0]);
            assert.deepEqual(result, sample[1]);
        });
    });

    it('Paths', () => {
        const result = fp.paths([
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
});
