const nock = require('nock');
const {auth} = require('../../src/jira/common');
const {url} = require('../../src/config').jira;

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

const {
    getUsers,
    checkUser,
    checkCommand,
    checkNamePriority,
    searchUser,
    getAllUsers,
    BASE_URL,
    parseEventBody,
} = require('../../src/matrix/timeline-handler/commands/helper');

describe('Commands helper tests', function() {
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
        const username = '@boom';
        nock(url, {
            reqheaders: {
                Authorization: auth(),
            },
        })
            .get(`/rest/api/2/user/search`)
            .times(3)
            .query({
                username,
                startAt: 0,
                maxResults: 999,
            })
            .reply(200, users)
            .get(`/rest/api/2/user/search`)
            .query({
                username,
                startAt: 0,
                maxResults: 3,
            })
            .reply(200, users.slice(0, 3))
            .get(`/rest/api/2/user/search`)
            .query({
                username,
                startAt: 3,
                maxResults: 3,
            })
            .reply(200, users.slice(3))
            .get(`/rest/api/2/user/search`)
            .query({
                username,
                startAt: 5,
                maxResults: 3,
            })
            .reply(400, 'ERROR!!!');
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

    it('checkCommand test', () => {
        const result = [
            checkCommand('move 1', 'done', 0),
            checkCommand('move', 'move', 2),
            checkCommand('move done', 'movedone', 4),
        ];
        expect(result).to.deep.equal([true, true, false]);
    });

    it('checkNamePriority test', () => {
        const priority = {
            name: 'Lowest'
        };
        const result = [
            checkNamePriority(priority, 0, 'Lowest'),
            checkNamePriority(priority, 2, '2'),
            checkNamePriority(priority, 4, 'Highest'),
            checkNamePriority(priority, 4, '5'),
        ];
        expect(result).to.deep.equal([true, false, false, true]);
    });

    it('getAllUsers test', async () => {
        const allUsers = await getAllUsers();
        expect(allUsers).to.be.deep.equal(users);
    });

    it('getUsers test', async () => {
        const maxResults = 3;
        const startAt = 0;
        const allUsers = await getUsers(maxResults, startAt);
        expect(allUsers).to.be.deep.equal(users);
    });

    it('BASE_URL test', () => {
        expect(BASE_URL).to.be.equal(`${url}/rest/api/2/issue`);
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

    it('getUsers test error', async () => {
        const maxResults = 3;
        const startAt = 5;
        try {
            const allUsers = await getUsers(maxResults, startAt);
            expect(allUsers).not.to.be;
        } catch (err) {
            const expected = [
                'getUsers error',
                'Error in request https://jira.bingo-boom.ru/jira/rest/api/2/user/search?username=%40boom&startAt=5&maxResults=3, status is 400',
                'ERROR!!!'
            ].join('\n');
            expect(err).to.be.deep.equal(expected)
        }
    });

});

describe('command handler test', () => {
    it('correct command name', () => {
        const body = '!help';
        const {commandName, bodyText} = parseEventBody(body);
        expect(commandName).to.be.equal('help');
        expect(bodyText).to.be.equal('');
    });

    it('correct command name', () => {
        const body = '!op gogogogo';
        const {commandName, bodyText} = parseEventBody(body);
        expect(commandName).to.be.equal('op');
        expect(bodyText).to.be.equal('gogogogo');
    });

    it('false command name', () => {
        const body = 'help';
        const {commandName, bodyText} = parseEventBody(body);
        expect(commandName).not.to.be;
    });

    it('false command name', () => {
        const body = '!!help';
        const {commandName, bodyText} = parseEventBody(body);
        expect(commandName).not.to.be;
        expect(bodyText).not.to.be;
    });
});
