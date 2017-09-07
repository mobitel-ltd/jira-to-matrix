/* eslint-disable no-console */
const {paramsToQueryString, fp} = require('../utils');

test('Prop in an array', () => { // eslint-disable-line no-undef
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
        expect(result).toBe(sample[3]); // eslint-disable-line no-undef
    });
});

// eslint-disable-next-line no-undef
test('Key/value pairs to URL query string', () => {
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
        expect(result).toBe(sample.result); // eslint-disable-line no-undef
    });
});

// eslint-disable-next-line no-undef
test('None-empty string', () => {
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
        expect(result).toBe(sample[1]); // eslint-disable-line no-undef
    });
});
