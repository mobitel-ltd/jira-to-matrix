/* eslint-disable id-length */
const Ramda = require('ramda');
const { tValues } = require('../../src/locales/ru');
const assert = require('assert');

it('Gender ending for a Russian full name', () => {
    const samples = [
        ['Иванова Анастасия Петровна', 'а'],
        ['Анастасия Петровна', 'а'],
        ['Анастасия', 'а'],
        ['Иванов Иван Иванович', ''],
        ['Иван Иванович', ''],
        ['Иван', ''],
        ['Иванов НетТакогоИмени Иванович', '(а)'],
        [null, '(а)'],
        [null, '(а)'],
        [{}, '(а)'],
        [[], '(а)'],
    ];
    const fn = Ramda.partial(tValues, [{ prop: 1, f: 125 }]);
    samples.forEach(sample => {
        const result = fn(sample[0]);
        const expected = { prop: 1, f: sample[1] };
        assert.deepEqual(result, expected);
    });
});
