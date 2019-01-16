const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const {userId: botId} = require('../../src/config').matrix;
const sdk = require('matrix-js-sdk');

const chai = require('chai');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);
const logger = require('../../src/modules/log.js')(module);
const {getMatrixUserID, COMMON_NAME} = require('../../src/lib/utils.js');

const {
    getRoomsLastUpdate,
    parseRoom,
    getOutdatedRoomsWithSender,
    checkUser,
    checkCommand,
    checkNamePriority,
    searchUser,
    getAllUsers,
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
const myUser = getMatrixUserID('myUser');
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
        new sdk.User(getMatrixUserID('ivan')),
        new sdk.User(getMatrixUserID('john')),
        new sdk.User(myUser),
        new sdk.User(botId),
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
