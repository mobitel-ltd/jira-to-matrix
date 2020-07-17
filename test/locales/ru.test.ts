import * as Ramda from 'ramda';
import { tValues } from '../../src/locales/ru';
import * as assert from 'assert';

describe('except Gender ending for a Russian fullname ', () => {
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
});
