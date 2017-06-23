const R = require('ramda')
const { tValues } = require('./ru')

test('Gender ending for a Russian full name', () => { // eslint-disable-line no-undef
  /* spell-checker: disable */
    const samples = [
    ['Иванова Анастасия Петровна', 'а'],
    ['Анастасия Петровна', 'а'],
    ['Анастасия', 'а'],
    ['Иванов Иван Иванович', ''],
    ['Иван Иванович', ''],
    ['Иван', ''],
    ['Иванов НетТакогоИмени Иванович', '(а)'],
    [undefined, '(а)'],
    [null, '(а)'],
    [{}, '(а)'],
    [[], '(а)'],
    ]
  /* spell-checker: enable */
    const fn = R.partial(tValues, [{ prop: 1, f: 125 }])
    samples.forEach((sample) => {
        const result = fn(sample[0])
        const expected = { prop: 1, f: sample[1] }
        expect(result).toEqual(expected) // eslint-disable-line no-undef
    })
})
