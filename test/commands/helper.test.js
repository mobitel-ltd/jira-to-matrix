const nock = require('nock');
const utils = require('../../src/lib/utils.js');

const chai = require('chai');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);
const {COMMON_NAME} = require('../../src/lib/utils.js');

const {checkUser, searchUser, parseEventBody} = require('../../src/bot/timeline-handler/commands/helper');

describe('Commands helper tests', () => {
    const userName = 'Ivan';
    const users = [
        {
            displayName: 'Ivan Andreevich A',
            name: 'ia_a',
        },
        {
            displayName: 'Ivan Sergeevich B',
            name: 'is_b',
        },
        {
            displayName: 'Anton Matveevich C',
            name: 'am_c',
        },
        {
            displayName: 'Petr Andreevich D',
            name: 'pa_d',
        },
    ];

    before(() => {
        nock(utils.getRestUrl())
            .get('/user/search')
            .times(3)
            .query({
                username: userName,
            })
            .reply(200, users)
            .get('/user/search')
            .times(3)
            .query({
                username: COMMON_NAME,
                startAt: 0,
                maxResults: 999,
            })
            .reply(200, users);
    });

    after(() => {
        nock.cleanAll();
    });

    it('checkUser test', () => {
        const user = {
            'name': 'test_name',
            'displayName': 'My Test User',
        };
        const result = [
            checkUser(user, 'My'),
            checkUser(user, 'MY TEST'),
            checkUser(user, 'test'),
            checkUser(user, '_NAMe'),
            checkUser(user, '_NMe'),
        ];
        expect(result).to.deep.equal([true, true, true, true, false]);
    });

    it('searchUser test', async () => {
        const result = await searchUser('Ivan');
        const expected = [
            {
                displayName: 'Ivan Andreevich A',
                name: 'ia_a',
            },
            {
                displayName: 'Ivan Sergeevich B',
                name: 'is_b',
            },
        ];
        expect(result).to.be.deep.equal(expected);
    });

    it('searchUser test with no name', async () => {
        const result = await searchUser('');
        const expected = [];
        expect(result).to.be.deep.equal(expected);
    });
});

describe('command handler test', () => {
    it('correct command name', () => {
        const body = '!help';
        const {commandName, bodyText} = parseEventBody(body);
        expect(commandName).to.be.equal('help');
        expect(bodyText).to.be.undefined;
    });

    it('correct command name', () => {
        const body = '!help   ';
        const {commandName, bodyText} = parseEventBody(body);
        expect(commandName).to.be.equal('help');
        expect(bodyText).to.be.undefined;
    });

    it('correct command name', () => {
        const body = '!op gogogogo';
        const {commandName, bodyText} = parseEventBody(body);
        expect(commandName).to.be.equal('op');
        expect(bodyText).to.be.equal('gogogogo');
    });

    it('false command name', () => {
        const body = 'help';
        const {commandName} = parseEventBody(body);
        expect(commandName).not.to.be;
    });

    it('false command name', () => {
        const body = '!!help';
        const {commandName, bodyText} = parseEventBody(body);
        expect(commandName).not.to.be;
        expect(bodyText).not.to.be;
    });
});

