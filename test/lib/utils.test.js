const utils = require('../../src/lib/utils');
const assert = require('assert');
const issueChangedHook = require('../fixtures/webhooks/issue/updated/commented-changed.json');
const body = require('../fixtures/webhooks/issue/updated/generic.json');
const issueUpdatedGenericHook = require('../fixtures/webhooks/issue/updated/generic.json');
const issueBody = require('../fixtures/jira-api-requests/issue.json');
const chai = require('chai');
const { stub } = require('sinon');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);

describe('Utils testing', () => {
    const expectedFuncKeys = ['test-jira-hooks:postEpicUpdates_2018-1-11 13:08:04,225'];

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
            [{ prop: 1 }, false],
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
            [
                {
                    comment: { author: { name: 'user1' } },
                    user: { name: 'user2' },
                },
                'user1',
            ],
            [
                {
                    user: { name: 'user2' },
                },
                'user2',
            ],
            [
                {
                    comment: { author1: { name: 'user1' } },
                    user: { name1: 'user2' },
                },
                undefined,
            ],
            [{ comment: {} }, undefined],
            [{}, undefined],
        ];
        samples.forEach(sample => {
            const result = utils.getHookUserName(sample[0]);
            expect(result).to.be.equal(sample[1]);
        });
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

    it('Expect getLimit to be timestamp of 01.01.2018', () => {
        const limit = utils.getLimit();
        const expected = 1514775600000;

        expect(limit).to.be.equal(expected);
    });

    it("Expect runMethod don't throw with unknown type", () => {
        const res = utils.runMethod({}, 'getCreator');

        expect(res).to.be.undefined;
    });

    it('Expect get roommembers works with issue from request', () => {
        const data = utils.getMembers(issueBody);

        expect(data).to.be.not.empty;
    });

    it('Expect getKeyFromError return correct key', () => {
        const key = 'BOPB-19';
        const str = `Error in postComment_1555586889467
                    Error in Post comment
                    No roomId for ${key} from Matrix
                    M_NOT_FOUND: Room alias #BOPB-19:matrix.bingo-boom.ru not found`;
        const data = utils.getKeyFromError(str);

        expect(data).to.be.eq(key);
    });

    describe('command handler test', () => {
        it('correct command name', () => {
            const body = '!help';
            const { commandName, bodyText } = utils.parseEventBody(body);
            expect(commandName).to.be.equal('help');
            expect(bodyText).to.be.undefined;
        });

        it('correct command name', () => {
            const body = '!help   ';
            const { commandName, bodyText } = utils.parseEventBody(body);
            expect(commandName).to.be.equal('help');
            expect(bodyText).to.be.undefined;
        });

        it('correct command name', () => {
            const body = '!op gogogogo';
            const { commandName, bodyText } = utils.parseEventBody(body);
            expect(commandName).to.be.equal('op');
            expect(bodyText).to.be.equal('gogogogo');
        });

        it('false command name', () => {
            const body = 'help';
            const { commandName } = utils.parseEventBody(body);
            expect(commandName).not.to.be;
        });

        it('false command name', () => {
            const body = '!!help';
            const { commandName, bodyText } = utils.parseEventBody(body);
            expect(commandName).not.to.be;
            expect(bodyText).not.to.be;
        });
    });

    describe('connect (ping Jira)', () => {
        it('connect any times (7)', async () => {
            const func = stub();
            func.rejects('Some error');
            func.onCall(7).resolves();
            await utils.connect(func, 100, 10);
            expect(func).to.be.callCount(8);
        });

        it('connect more 10 time and error', async () => {
            const func = stub();
            func.rejects('Some error');
            const countCall = 10;
            try {
                await utils.connect(func, 10, countCall);
            } catch (err) {
                expect(err).to.be.equal('No connection.');
            }
            expect(func).to.be.callCount(countCall);
        });
    });
});
