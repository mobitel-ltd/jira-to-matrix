const nock = require('nock');
const {auth} = require('../../src/lib/utils.js');
const {jira: {url}, matrix: {userId: matrixUserId}} = require('../../src/config');
const {getRequestErrorLog} = require('../../src/lib/request');
const querystring = require('querystring');
const sdk = require('matrix-js-sdk');

const chai = require('chai');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);
const logger = require('../../src/modules/log.js')(module);
const {getUserID} = require('../../src/bot/helper');
const {COMMON_NAME} = require('../../src/lib/utils.js');

const {
    getRoomsLastUpdate,
    parseRoom,
    getLimit,
    getOutdatedRoomsWithSender,
    getUsers,
    checkUser,
    checkCommand,
    checkNamePriority,
    searchUser,
    getAllUsers,
    BASE_URL,
    parseEventBody,
} = require('../../src/matrix/timeline-handler/commands/helper');

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
    const errorStatus = 400;
    const errorParams = {
        username: COMMON_NAME,
        startAt: 5,
        maxResults: 3,
    };
    const urlPath = `/rest/api/2/user/search`;

    before(() => {
        nock(url, {
            reqheaders: {
                Authorization: auth(),
            },
        })
            .get(urlPath)
            .times(3)
            .query({
                username: userName,
            })
            .reply(200, users)
            .get(urlPath)
            .times(3)
            .query({
                username: COMMON_NAME,
                startAt: 0,
                maxResults: 999,
            })
            .reply(200, users)
            .get(urlPath)
            .query({
                username: COMMON_NAME,
                startAt: 0,
                maxResults: 3,
            })
            .reply(200, users.slice(0, 3))
            .get(urlPath)
            .query({
                username: COMMON_NAME,
                startAt: 3,
                maxResults: 3,
            })
            .reply(200, users.slice(3))
            .get(urlPath)
            .query(errorParams)
            .reply(errorStatus, 'ERROR!!!');
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
            name: 'Lowest',
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

    it('searchUser test with no name', async () => {
        const result = await searchUser('');
        const expected = [];
        expect(result).to.be.deep.equal(expected);
    });

    it('getUsers test error', async () => {
        const maxResults = 3;
        const startAt = 5;
        try {
            const allUsers = await getUsers(maxResults, startAt);
            expect(allUsers).not.to.be;
        } catch (err) {
            const fakeUrl = `${url}${urlPath}?${querystring.stringify(errorParams)}`;
            const requestErrorLog = getRequestErrorLog(fakeUrl, errorStatus);
            const expected = [
                'getUsers error',
                requestErrorLog,
            ].join('\n');
            expect(err).to.be.deep.equal(expected);
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

const getTimeline = date => ({
    getTs: () => date.getTime(),
    getDate: () => date,
});

const roomMock = (roomId, roomName, members, timeline) =>
    ({
        roomId,
        name: roomName,
        getJoinedMembers: () => members,
        timeline,
    });
const roomName = 'roomName';
const roomId = '!roomId';
const myUser = getUserID('myUser');
describe('Test room kicking funcs', () => {
    const lastDate = getTimeline(new Date(2018, 5, 5));
    const outDatedTimeline = [
        getTimeline(new Date(2017, 5, 5)),
        getTimeline(new Date(2017, 10, 10)),
    ];
    const timeline = [
        ...outDatedTimeline,
        getTimeline(new Date(2018, 2, 3)),
        lastDate,
    ];
    // logger.debug(timeline.map(time => time.getDate()));

    const members = [
        new sdk.User(getUserID('ivan')),
        new sdk.User(getUserID('john')),
        new sdk.User(myUser),
        new sdk.User(matrixUserId),
    ];
    const newRoom = roomMock(roomId, roomName, members, timeline);

    describe('Testsing parseRoom', () => {
        it('Expect parseRoom to be ', () => {
            const [{members, room, timestamp}] = parseRoom([], newRoom);
            logger.debug(members);

            expect(members.length).to.be.eq(3);
            expect(room).to.be.deep.eq({roomId, roomName});
            expect(timestamp).to.be.eq(lastDate.getTs());
        });

        it('Expect parseRoom not fall if room has no lastevent', () => {
            const result = parseRoom([], roomMock(roomId, roomName, members, []));

            expect(result).to.be.deep.eq([]);
        });
    });

    describe('Testsing getLimit', () => {
        it('Expect getLimit to be timestamp of 01.01.2018', () => {
            const limit = getLimit();
            const expected = 1514775600000;

            expect(limit).to.be.equal(expected);
        });
    });

    describe('Testsing getRoomsLastUpdate', () => {
        it('Expect getRoomsLastUpdate to be ', () => {
            const result = getRoomsLastUpdate([newRoom], myUser);

            expect(result.length).not.to.be;
        });

        it('Expect getRoomsLastUpdate not to be for room which has last event from last year', () => {
            const testRoom = roomMock(roomId, roomName, members, outDatedTimeline);
            const result = getRoomsLastUpdate([testRoom], myUser);

            expect(result.length).to.be;
        });
    });

    describe('Testsing getOutdatedRoomsWithSender', () => {
        it('Expect getOutdatedRoomsWithSender to be ', () => {
            logger.debug('newRoom', newRoom);
            const parsedRoom = parseRoom([], newRoom);
            logger.debug('parsedRoom', parsedRoom);
            const result = getOutdatedRoomsWithSender(myUser)(parsedRoom);

            expect(result).to.be.false;
        });
    });
});
