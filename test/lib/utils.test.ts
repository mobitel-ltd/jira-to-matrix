import * as R from 'ramda';
import * as assert from 'assert';
import issueChangedHook from '../fixtures/webhooks/issue/updated/commented-changed.json';
import body from '../fixtures/webhooks/issue/updated/generic.json';
import issueUpdatedGenericHook from '../fixtures/webhooks/issue/updated/generic.json';
import issueBody from '../fixtures/jira-api-requests/issue.json';
import * as chai from 'chai';
import { isIgnoreKey } from '../../src/redis-client';
import {
    getNewStatus,
    getChangelogField,
    getComment,
    runMethod,
    getMembers,
} from '../../src/task-trackers/jira/selector.jira';
import { getKeyFromError } from '../../src/lib/utils';
const { expect } = chai;

const nonEmptyString = R.both(R.is(String), R.complement(R.isEmpty));

const propIn = R.curry((prop, arr, obj) => R.or(arr, []).includes(R.or(obj, {})[prop]));

describe('Utils testing', () => {
    const expectedFuncKeys = ['test-jira-hooks:postEpicUpdates_2018-1-11 13:08:04,225'];

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
            ['prop', [1, 2], { prop: 1 }, true],
            ['prop', [undefined, 2], { prop: undefined }, true],
            ['prop', [1, 2], { prop: 3 }, false],
            ['prop', [1, 2], { prop1: 1 }, false],
            ['prop', [1, 2], undefined, false],
            ['prop', [1, 2], {}, false],
            ['prop', [1, 2], { prop: undefined }, false],
            ['prop', [1, 2], { prop: null }, false],
        ];
        samples.forEach(sample => {
            const fn1 = propIn(sample[0]);
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
            [{ prop: 1 }, false],
            [[], false],
        ];
        samples.forEach(sample => {
            const result = nonEmptyString(sample[0]);
            assert.deepEqual(result, sample[1]);
        });
    });

    it('getNewStatus', () => {
        const status = getNewStatus(issueChangedHook);
        assert.equal(status, 'Closed');
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

    it('Expect getComment return undefined', () => {
        const body = getComment(issueUpdatedGenericHook);
        expect(body).to.be.undefined;
    });

    it("Expect runMethod don't throw with unknown type", () => {
        const res = runMethod({}, 'getCreator');

        expect(res).to.be.undefined;
    });

    it('Expect get roommembers works with issue from request', () => {
        const data = getMembers(issueBody);

        expect(data).to.be.not.empty;
    });

    it('Expect getKeyFromError return correct key', () => {
        const key = 'BOPB-19';
        const str = `Error in postComment_1555586889467
                    Error in Post comment
                    No roomId for ${key} from Matrix
                    M_NOT_FOUND: Room alias #BOPB-19:matrix.bingo-boom.ru not found`;
        const data = getKeyFromError(str);

        expect(data).to.be.eq(key);
    });
});
