const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
const sdk = require('matrix-js-sdk');
const {getUserID} = require('../../src/bot/helper');
const {matrix: {userId: matrixUserId}} = require('../../src/config');
const proxyquire = require('proxyquire');
const logger = require('../../src/modules/log')(module);
const translate = require('../../src/locales');

chai.use(sinonChai);
const infoStub = stub();
const kick = proxyquire('../../src/matrix/timeline-handler/commands/kick.js', {
    '../../../modules/log.js': () => ({
        info: infoStub,
        debug: logger.debug,
    }),
});

const kickStub = stub();
const getRoomsStub = stub();
const sendHtmlMessageStub = stub();

const clientStub = {
    sendHtmlMessage: sendHtmlMessageStub,
    kick: kickStub,
    getRooms: getRoomsStub,
};

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
const sender = 'myUser';
const myUser = getUserID(sender);
const room = {roomId};

describe('Test kicking from room', () => {
    const timeline = [
        getTimeline(new Date(2017, 5, 5)),
        getTimeline(new Date(2017, 10, 10)),
    ];
    // logger.debug(timeline.map(time => time.getDate()));

    const members = [
        new sdk.User(getUserID('ivan')),
        new sdk.User(getUserID('john')),
        new sdk.User(myUser),
        new sdk.User(matrixUserId),
    ];
    beforeEach(() => {
        kickStub.withArgs(roomId, getUserID('ivan'), 'This room is outdated').throws();
        const rooms = [
            roomMock(roomId, roomName, members, timeline),
            roomMock(roomId, roomName, members, timeline),
        ];
        getRoomsStub.resolves(rooms);
    });

    it('Expect to kick from room', async () => {
        await kick({sender, matrixClient: clientStub, room});
        const kickInfo = translate('kickInfo', {sender});
        const msgItem = [
            translate('errorUserKick', {user: getUserID('ivan'), roomName}),
            translate('successUserKick', {user: getUserID('john'), roomName}),
            translate('successUserKick', {user: myUser, roomName}),
        ];
        const kickMsg = [msgItem, msgItem];
        // logger.debug();
        expect(infoStub).to.be.calledWithExactly(kickInfo, kickMsg);
    });

    it('Expect error to be thrown while "get all rooms" will fall', async () => {
        const errName = 'some error';
        getRoomsStub.throws(errName);
        try {
            await kick({sender, matrixClient: clientStub, room});
        } catch (err) {
            expect(err).to.be.eq(`Matrix kick command error\n${errName}`);
        }
    });
});
